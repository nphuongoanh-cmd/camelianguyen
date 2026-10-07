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

  let endpoint = '';
  let current = null; // last poll + results returned by the server

  async function call(body) {
    const res = body
      ? await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
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
    const total = results ? results.total : 0;
    const options = poll.options.map(o => {
      const mine = voted && o.n === data.choice;
      const pct = results && total ? Math.round(results.counts[o.n] * 100 / total) : 0;
      return `<li>
        <button class="poll-option${mine ? ' mine' : ''}" data-n="${o.n}" aria-pressed="${mine}">
          ${results && voted ? `<span class="poll-bar" style="width:${pct}%"></span>` : ''}
          <span class="poll-label">${esc(o.label)}</span>
          ${results && voted ? `<span class="poll-pct">${pct}${NB}%</span>` : ''}
        </button>
      </li>`;
    }).join('');

    root.innerHTML = `
      ${voted
        ? `<h1>Merci, <mark>c’est noté</mark></h1>
           ${poll.thanks ? `<p class="hand">${esc(poll.thanks)}</p>` : ''}`
        : `<h1>Ton <mark>avis</mark></h1>`}
      <div class="card">
        <h2 class="title-it">${esc(poll.question)}</h2>
        <ul class="poll-options">${options}</ul>
        ${results && voted ? `<p class="muted">${total} réponse${total > 1 ? 's' : ''} pour l’instant</p>` : ''}
      </div>
      <p class="muted">${voted
        ? `Tu as changé d’avis${NB}? Touche une autre réponse, elle remplacera la première.`
        : `Touche ta réponse${NB}: c’est tout.`}</p>
      <p class="error" role="alert" hidden>Oups, ton vote n’a pas pu être enregistré. Tu peux réessayer${NB}?</p>`;

    root.querySelectorAll('.poll-option').forEach(btn => {
      btn.addEventListener('click', () => vote(Number(btn.dataset.n)));
    });
  }

  async function vote(n) {
    root.querySelectorAll('.poll-option').forEach(b => { b.disabled = true; });
    try {
      render(await call({ poll: pollId, choice: n, email }), true);
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
    root.innerHTML = `<p class="hand">${choice ? 'j’enregistre ton vote…' : 'un instant…'}</p>`;
    try {
      endpoint = (await (await fetch('data/sondage.json', { cache: 'no-cache' })).json()).endpoint;
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
