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
  // t=1 marks the free-text answer ("Autre chose (je te raconte)"), so the text
  // box can show at once, before Google replies.
  const freeTextLink = params.get('t') === '1';
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

  // The thank-you is shown in one go, once Google has replied and the fonts
  // are ready, so no line pops in after the others. Fonts get 2 s at most.
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('700 22px Caveat'), document.fonts.load('800 32px Fraunces')]),
    new Promise(done => setTimeout(done, 2000)),
  ]).catch(() => {});
  const waiting = `<div class="poll-wait" role="status" aria-label="Un instant"><svg class="peony" viewBox="0 0 120 120" aria-hidden="true"><use href="#peony"/></svg></div>`;

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

  const textForm = () => `
    <form class="poll-text">
      <label for="poll-text" class="poll-text-hint">Écris ici, aussi peu ou autant que tu veux.</label>
      <textarea id="poll-text" maxlength="2000" rows="5"></textarea>
      <button class="btn" type="submit">Envoyer</button>
    </form>`;

  // Re-rendering must not lose what the subscriber is typing.
  function keepTyping(fn) {
    const box = root.querySelector('textarea');
    const typed = box ? box.value : '';
    const focused = box && document.activeElement === box;
    fn();
    const next = root.querySelector('textarea');
    if (next && typed) next.value = typed;
    if (next && focused) next.focus();
    const form = root.querySelector('.poll-text');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); sendText(form); });
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

    // The free-text answer is thanked only once the message is sent.
    const waitingForText = voted && data.choice === poll.freeText && !textSent;
    const top = !voted ? ''
      : waitingForText ? `<h1>Raconte-<mark>moi</mark></h1>${textForm()}`
      : `<h1>Merci, <mark>c’est noté</mark></h1>
         ${poll.thanks ? `<p class="hand">${esc(poll.thanks)}</p>` : ''}
         ${textSent && data.choice === poll.freeText ? `<p class="hand poll-sent">Bien reçu. Je lis tout.</p>` : ''}`;

    keepTyping(() => {
      root.innerHTML = `
        ${top}
        <p class="error" role="alert" hidden>Oups, ça n’a pas pu être enregistré. Tu peux réessayer${NB}?</p>
        ${voted && !showResults ? '' : `<div class="poll-card">
          ${poll.intro ? `<p class="poll-intro">${esc(poll.intro)}</p>` : ''}
          <h2 class="poll-q">${esc(poll.question)}</h2>
          <ul class="poll-options">${options}</ul>
          <p class="poll-note">${voted
            ? `${showResults ? `${total} réponse${total > 1 ? 's' : ''} pour l’instant. ` : ''}Tu as changé d’avis${NB}? Touche une autre réponse.`
            : esc(poll.note || `Un clic suffit.`)}</p>
        </div>`}`;
    });

    root.querySelectorAll('.poll-option').forEach(btn => {
      btn.addEventListener('click', () => vote(Number(btn.dataset.n)));
    });
  }

  async function sendText(form) {
    const text = form.querySelector('textarea').value.trim();
    if (!text) return form.querySelector('textarea').focus();
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Envoi…';
    try {
      // Sending the text also records the vote, so it works even if the
      // first request is still on its way.
      const data = await call({ poll: pollId, choice: current ? current.choice : choice, text });
      await fontsReady;
      textSent = true;
      render(data, true);
      window.scrollTo(0, 0);
    } catch {
      button.disabled = false;
      button.textContent = 'Envoyer';
      root.querySelector('.error').hidden = false;
    }
  }

  function failed(err, retry) {
    if (err.message === 'unknown_poll') return message('Sondage introuvable', `Ce sondage n’existe plus, ou le lien est incomplet.`);
    if (err.message === 'unknown_option') return message('Réponse introuvable', `Cette réponse ne fait pas partie du sondage. Reviens à ton email et touche une autre réponse.`);
    if (current) {
      render(current, current.choice != null);
      root.querySelector('.error').hidden = false;
      return;
    }
    message('Oups', `${retry}. Vérifie ta connexion, puis <a href="#" id="retry">réessaie</a>.`);
    document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); start(); });
  }

  async function vote(n) {
    root.querySelectorAll('.poll-option').forEach(b => { b.disabled = true; });
    try {
      const data = await call({ poll: pollId, choice: n });
      await fontsReady;
      textSent = textSent && current && current.choice === n;
      render(data, true);
    } catch (err) {
      failed(err, 'Ton vote n’a pas pu être enregistré');
    }
  }

  async function start() {
    if (!pollId) return message('Sondage introuvable', `Ce lien semble incomplet. Reviens à ton email et touche à nouveau ta réponse.`);
    // Google takes a second or two to save the vote. The free-text answer opens
    // its text box right away; otherwise a peony waits until the whole thank-you
    // can show at once. keepalive lets the vote through even if the subscriber
    // closes the page before then. Once they have voted, the answers only show
    // again if the poll shows results.
    if (choice && freeTextLink) keepTyping(() => {
      root.innerHTML = `<h1>Raconte-<mark>moi</mark></h1>${textForm()}<p class="error" role="alert" hidden>Oups, ça n’a pas pu être enregistré. Tu peux réessayer${NB}?</p>`;
    });
    else root.innerHTML = waiting;
    try {
      endpoint = (await (await fetch('data/sondage.json')).json()).endpoint;
      if (choice) return vote(choice);
      const data = await call();
      await fontsReady;
      render(data, false);
    } catch (err) {
      failed(err, 'Impossible de charger le sondage');
    }
  }

  start();
})();
