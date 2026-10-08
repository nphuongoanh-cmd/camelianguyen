// One-click newsletter polls. Each answer in the email links here with
// ?p=<poll id>&c=<option number>&e=<subscriber email>; opening the link records
// the vote right away. The vote is sent from this page's script (not by the
// link itself), so email scanners that only fetch links don't count as votes.
(() => {
  const root = document.getElementById('poll');
  const NB = ' '; // narrow no-break space before ? ! : ;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const params = new URLSearchParams(location.search);
  const pollId = (params.get('p') || '').trim();
  const choice = Number(params.get('c')) || null;
  // In a query string "+" reads as a space, and an email address never has one.
  const fromLink = (params.get('e') || '').trim().replace(/ /g, '+');

  // Keep the email out of the address bar and browser history, and remember it
  // for this tab so a refresh or a changed answer still counts as the same person.
  const emailKey = `pp:poll-email:${pollId}`;
  const session = {
    get() { try { return sessionStorage.getItem(emailKey) || ''; } catch { return ''; } },
    set(v) { try { sessionStorage.setItem(emailKey, v); } catch { /* private mode */ } },
  };
  if (fromLink) session.set(fromLink);
  const email = fromLink || session.get();
  if (pollId) history.replaceState(null, '', `${location.pathname}?p=${encodeURIComponent(pollId)}`);

  // Without an email (a forwarded email, a test send), this random id lets a
  // changed answer or a free-text message replace this tab's vote, not add one.
  const vidKey = `pp:poll-vid:${pollId}`;
  let vid = '';
  try {
    vid = sessionStorage.getItem(vidKey) || '';
    if (!vid) sessionStorage.setItem(vidKey, vid = crypto.randomUUID());
  } catch { vid = Math.random().toString(36).slice(2); }

  let endpoint = '';
  let current = null; // last poll + results returned by the server
  let textSent = false;

  async function call(body) {
    const res = body
      ? await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, email, vid }), keepalive: true })
      : await fetch(`${endpoint}?poll=${encodeURIComponent(pollId)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
  }

  function message(title, text) {
    root.innerHTML = `<h1>${title}</h1><p>${text}</p>`;
  }

  function render(data, voted) {
    current = data;
    const { poll, results } = data;
    const showResults = results && voted;
    const total = results ? results.total : 0;
    const options = poll.options.map(o => {
      const mine = voted && o.n === data.choice;
      const pct = showResults && total ? Math.round(results.counts[o.n] * 100 / total) : 0;
      return `<li>
        <button class="poll-option${mine ? ' mine' : ''}" data-n="${o.n}" aria-pressed="${mine}">
          ${showResults ? `<span class="poll-bar" style="width:${pct}%"></span>` : ''}
          <span class="poll-label">${esc(o.label)}</span>
          ${showResults ? `<span class="poll-pct">${pct}${NB}%</span>` : ''}
        </button>
      </li>`;
    }).join('');

    const freeText = voted && data.choice === poll.freeText;
    const textForm = !freeText ? '' : textSent
      ? `<p class="hand poll-sent">Bien reçu. Je lis tout.</p>`
      : `<form class="poll-text">
          <label for="poll-text">Raconte-moi${NB}:</label>
          <textarea id="poll-text" maxlength="2000" rows="4" placeholder="Écris ici, aussi peu ou autant que tu veux…"></textarea>
          <button class="btn" type="submit">Envoyer</button>
        </form>`;

    root.innerHTML = `
      ${voted ? `<h1>Merci, <mark>c’est noté</mark></h1>
        ${poll.thanks ? `<p class="hand">${esc(poll.thanks)}</p>` : ''}` : ''}
      <div class="poll-card">
        ${poll.intro ? `<p class="poll-intro">${esc(poll.intro)}</p>` : ''}
        <h2 class="poll-q">${esc(poll.question)}</h2>
        <ul class="poll-options">${options}</ul>
        ${textForm}
        <p class="poll-note">${voted
          ? `${showResults ? `${total} réponse${total > 1 ? 's' : ''} pour l’instant. ` : ''}Tu as changé d’avis${NB}? Touche une autre réponse.`
          : esc(poll.note || `Un clic suffit.`)}</p>
      </div>
      <p class="error" role="alert" hidden>Oups, ça n’a pas pu être enregistré. Tu peux réessayer${NB}?</p>`;

    root.querySelectorAll('.poll-option').forEach(btn => {
      btn.addEventListener('click', () => vote(Number(btn.dataset.n)));
    });
    const form = root.querySelector('.poll-text');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); sendText(form); });
  }

  async function sendText(form) {
    const text = form.querySelector('textarea').value.trim();
    if (!text) return form.querySelector('textarea').focus();
    form.querySelector('button').disabled = true;
    try {
      const data = await call({ poll: pollId, choice: current.poll.freeText, text });
      textSent = true;
      render(data, true);
    } catch {
      form.querySelector('button').disabled = false;
      root.querySelector('.error').hidden = false;
    }
  }

  async function vote(n) {
    root.querySelectorAll('.poll-option').forEach(b => { b.disabled = true; });
    try {
      textSent = false;
      render(await call({ poll: pollId, choice: n }), true);
    } catch (err) {
      if (err.message === 'unknown_poll') {
        message('Sondage introuvable', `Ce sondage n’existe plus, ou le lien est incomplet.`);
      } else if (current) {
        render(current, current.choice != null);
        root.querySelector('.error').hidden = false;
      } else {
        message('Oups', `Ton vote n’a pas pu être enregistré. Vérifie ta connexion, puis <a href="#" id="retry">réessaie</a>.`);
        document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); start(); });
      }
    }
  }

  async function start() {
    if (!pollId) return message('Sondage introuvable', `Ce lien semble incomplet. Reviens à ton email et touche à nouveau ta réponse.`);
    // Google takes a second or two to save the vote: say thank you right away,
    // the answers and results fill in when it replies. keepalive lets the vote
    // through even if the subscriber closes the page before then.
    root.innerHTML = choice
      ? `<h1>Merci, <mark>c’est noté</mark></h1><div class="poll-card"><p class="hand">un instant…</p></div>`
      : `<p class="hand">un instant…</p>`;
    try {
      endpoint = (await (await fetch('data/sondage.json')).json()).endpoint;
      if (choice) return vote(choice);
      render(await call(), false);
    } catch (err) {
      if (err.message === 'unknown_poll') return message('Sondage introuvable', `Ce sondage n’existe plus, ou le lien est incomplet.`);
      message('Oups', `Impossible de charger le sondage. Vérifie ta connexion, puis <a href="#" id="retry">réessaie</a>.`);
      document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); start(); });
    }
  }

  start();
})();
