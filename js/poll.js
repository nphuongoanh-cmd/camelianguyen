// One-click newsletter polls. Each answer in the email links here with
// ?p=<poll id>&c=<option number>&e=<subscriber email>; opening the link records
// the vote right away. The vote is sent from this page's script (not by the
// link itself), so email scanners that only fetch links don't count as votes.
//
// What the page says after a vote comes from data/merci.json: a title,
// a line, an illustration, and for some answers a box with a button. When a
// poll has its words there (like the welcome poll), the page shows them at
// once while Google saves the vote; otherwise it waits for Google and uses the
// thank-you message from the Polls tab.
(() => {
  const root = document.getElementById('poll');
  const NB = ' '; // narrow no-break space before ? ! : ;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // "Merci, [c’est noté]" -> Merci, <mark>c’est noté</mark>
  const title = s => esc(s).replace(/\[(.+?)\]/g, '<mark>$1</mark>');

  const params = new URLSearchParams(location.search);
  const pollId = (params.get('p') || '').trim();
  const choice = Number(params.get('c')) || null;
  // t=1 marks the free-text answer ("Autre chose (je te raconte)").
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

  // A page is shown in one go once its fonts are ready (2 s at most), so no
  // line changes style after appearing.
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('700 34px Caveat'), document.fonts.load('800 40px Fraunces'), document.fonts.load('600 18px "Nunito Sans"')]),
    new Promise(done => setTimeout(done, 2000)),
  ]).catch(() => {});
  const waiting = `<div class="wait" role="status" aria-label="Un instant"><svg viewBox="0 0 120 120" aria-hidden="true"><use href="#peony"/></svg></div>`;

  let endpoint = '';
  let words = null;     // this poll's words from data/merci.json
  let current = null;   // last poll + results returned by Google
  let chosen = choice;  // the answer on screen
  let view = '';        // 'merci', 'raconte' or 'envoye'

  async function call(body) {
    const res = body
      ? await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, email, vid }), keepalive: true })
      : await fetch(`${endpoint}?poll=${encodeURIComponent(pollId)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
  }

  function message(heading, text) {
    view = '';
    root.innerHTML = `<h1>${heading}</h1><p class="lead">${text}</p>`;
  }

  const image = name => name ? `<img class="vis" src="assets/merci/${encodeURIComponent(name)}.webp" alt="">` : '';
  const signature = () => words.signature ? `<p class="sig">${esc(words.signature)}</p>` : '';
  const isFreeText = n => n === (current ? current.poll.freeText : words.freeText);

  // The words for an answer: the poll's "merci" page, with what this answer changes.
  function merciWords(n) {
    const a = (words.answers && words.answers[n]) || {};
    return { ...words.merci, ...a };
  }

  // Can the thank-you for this answer show before Google replies?
  const knownInAdvance = n => merciWords(n).lead !== null;

  function results() {
    const r = current && current.results;
    if (!r) return '';
    const total = r.total;
    return `<ul class="options results">${current.poll.options.map(o => {
      const pct = total ? Math.round(r.counts[o.n] * 100 / total) : 0;
      return `<li><div class="option${o.n === chosen ? ' mine' : ''}">
        <span class="bar" style="width:${pct}%"></span>
        <span class="label">${esc(o.label)}</span><span class="pct">${pct}${NB}%</span></div></li>`;
    }).join('')}</ul>
    <p class="note">${total} réponse${total > 1 ? 's' : ''} pour l’instant</p>`;
  }

  function showMerci() {
    view = 'merci';
    const w = merciWords(chosen);
    const lead = w.lead !== null ? w.lead : (current && current.poll.thanks) || '';
    const next = w.next && words.next ? `
      <div class="next">
        ${w.nextTitle || words.next.title ? `<p class="k">${esc(w.nextTitle || words.next.title)}</p>` : ''}
        <p>${esc(w.next)}</p>
        <a class="btn" href="${esc(words.next.link)}" target="_blank" rel="noopener">${esc(words.next.button)}</a>
      </div>` : '';
    root.innerHTML = `${image(w.image)}
      <h1>${title(w.title)}</h1>
      ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
      ${next}${results()}${signature()}`;
    document.title = 'Merci · Papier Pivoine';
  }

  function showRaconte() {
    view = 'raconte';
    const w = words.raconte;
    root.innerHTML = `${image(w.image)}
      <h1>${title(w.title)}</h1>
      <p class="lead">${esc(w.lead)}</p>
      <form>
        <label for="message">${esc(w.label)}</label>
        <textarea id="message" maxlength="2000"></textarea>
        <p class="err" role="alert" hidden>Oups, ça n’a pas pu être envoyé. Tu peux réessayer${NB}?</p>
        <div class="row"><button class="btn" type="submit">${esc(w.button)}</button></div>
      </form>`;
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); sendText(); });
    document.title = 'Raconte-moi · Papier Pivoine';
  }

  function showEnvoye() {
    view = 'envoye';
    const w = words.envoye;
    root.innerHTML = `${image(w.image)}
      <h1>${title(w.title)}</h1>
      <p class="lead">${esc(w.lead)}</p>
      ${signature()}`;
    document.title = 'Merci · Papier Pivoine';
  }

  // The poll itself, when the page is opened without an answer.
  function showQuestion() {
    view = '';
    const { poll } = current;
    root.innerHTML = `
      ${poll.intro ? `<p class="kicker">${esc(poll.intro)}</p>` : ''}
      <h1 class="q">${esc(poll.question)}</h1>
      <ul class="options">${poll.options.map(o => `
        <li><button class="option" data-n="${o.n}"><span class="label">${esc(o.label)}</span></button></li>`).join('')}
      </ul>
      ${poll.note ? `<p class="note">${esc(poll.note)}</p>` : ''}`;
    root.querySelectorAll('.option').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.option').forEach(x => { x.disabled = true; });
      vote(Number(b.dataset.n));
    }));
  }

  function failed(err, retry) {
    if (err.message === 'unknown_poll') return message('Sondage introuvable', `Ce sondage n’existe plus, ou le lien est incomplet.`);
    if (err.message === 'unknown_option') return message('Réponse introuvable', `Cette réponse ne fait pas partie du sondage. Reviens à ton email et touche une autre réponse.`);
    // A thank-you already on screen stays; a note under it offers to try again.
    if (view === 'merci' || view === 'raconte') {
      if (root.querySelector('.err.vote')) return;
      root.insertAdjacentHTML('beforeend', `<p class="err vote" role="alert">Oups, ton vote n’a pas pu être enregistré. <button type="button">Réessayer</button></p>`);
      root.querySelector('.err.vote button').addEventListener('click', () => { root.querySelector('.err.vote').remove(); vote(chosen); });
      return;
    }
    message('Oups', `${retry}. Vérifie ta connexion, puis <a href="#" id="retry">réessaie</a>.`);
    document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); start(); });
  }

  async function vote(n) {
    chosen = n;
    const free = (freeTextLink && n === choice) || isFreeText(n);
    // Show what can be shown before Google replies.
    if (free) { if (view !== 'raconte' && view !== 'envoye') { await fontsReady; showRaconte(); } }
    else if (knownInAdvance(n)) { await fontsReady; showMerci(); }
    else root.innerHTML = waiting;

    try {
      const data = await call({ poll: pollId, choice: n });
      current = data;
      if (view === 'envoye' || view === 'raconte') return;      // nothing to update
      if (data.choice === data.poll.freeText) { await fontsReady; return showRaconte(); }
      // Re-draw only when Google brings something new: the Sheet's thank-you or the results.
      if (view === 'merci' && knownInAdvance(n) && !data.results) return;
      await fontsReady;
      showMerci();
    } catch (err) {
      failed(err, 'Ton vote n’a pas pu être enregistré');
    }
  }

  async function sendText() {
    const box = root.querySelector('textarea');
    const text = box.value.trim();
    if (!text) return box.focus();
    // The peony waits while the message is sent. The page itself is set
    // aside, not destroyed, so it comes back as it was if sending fails.
    const page = [...root.childNodes];
    root.innerHTML = waiting;
    try {
      // Sending the text also records the vote, so it works even if the
      // first request is still on its way.
      current = await call({ poll: pollId, choice: chosen, text });
      await fontsReady;
      showEnvoye();
    } catch {
      root.replaceChildren(...page);
      root.querySelector('form .err').hidden = false;
    }
  }

  async function start() {
    if (!pollId) return message('Sondage introuvable', `Ce lien semble incomplet. Reviens à ton email et touche à nouveau ta réponse.`);
    root.innerHTML = waiting;
    try {
      const [config, merci] = await Promise.all([
        fetch('data/sondage.json').then(r => r.json()),
        fetch('data/merci.json').then(r => r.json()),
      ]);
      endpoint = config.endpoint;
      const own = merci[pollId] || {};
      words = { ...merci._default, ...own };
      ['merci', 'raconte', 'envoye'].forEach(k => { words[k] = { ...merci._default[k], ...(own[k] || {}) }; });
    } catch {
      message('Oups', `Impossible de charger la page. Vérifie ta connexion, puis <a href="#" id="retry">réessaie</a>.`);
      document.getElementById('retry').addEventListener('click', e => { e.preventDefault(); start(); });
      return;
    }
    if (choice) return vote(choice);
    try {
      current = await call();
      await fontsReady;
      showQuestion();
    } catch (err) {
      failed(err, 'Impossible de charger le sondage');
    }
  }

  start();
})();
