// Feedback forms ("Ton avis sur…"), defined in data/avis.json. The email asks
// the first question: each answer links here with
// ?f=<form id>&a=<answer number>&e=<subscriber email>&n=<first name>, which
// saves that answer right away and opens the rest of the form with it filled
// in. Without a=, the page is the whole form (for a link on a website or a QR
// code). Answers go to the "Avis" tab of the Google Sheet, through the same
// Apps Script as the polls.
(() => {
  const root = document.getElementById('avis');
  const NB = ' '; // narrow no-break space before ? ! : ;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SHARE_WITH_NAME = 'Oui, avec mon prénom';

  const params = new URLSearchParams(location.search);
  const formId = (params.get('f') || '').trim().toLowerCase();
  const firstAnswer = Number(params.get('a')) || null;

  // Keep the email and name out of the address bar and history, and remember
  // them for this tab, like the poll page does.
  const remember = (key, fromLink) => {
    const k = `pp:avis-${key}:${formId}`;
    try {
      if (fromLink) sessionStorage.setItem(k, fromLink);
      return fromLink || sessionStorage.getItem(k) || '';
    } catch { return fromLink; }
  };
  // In a query string "+" reads as a space, and an email address never has one.
  const email = remember('email', (params.get('e') || '').trim().replace(/ /g, '+'));
  // An empty or unfilled Kit merge tag is not a name.
  const linkName = (params.get('n') || '').trim();
  const name = remember('name', /[{}]/.test(linkName) ? '' : linkName);
  let vid = remember('vid', '');
  if (!vid) vid = remember('vid', (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2));
  if (formId) history.replaceState(null, '', `${location.pathname}?f=${encodeURIComponent(formId)}`);

  const waiting = `<div class="poll-wait" role="status" aria-label="Un instant"><svg class="peony" viewBox="0 0 120 120" aria-hidden="true"><use href="#peony"/></svg></div>`;
  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('700 22px Caveat'), document.fonts.load('800 32px Fraunces')]),
    new Promise(done => setTimeout(done, 2000)),
  ]).catch(() => {});
  const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

  let form = null;      // this form's definition
  let endpoint = '';
  const answers = {};   // question id -> answer (option label, or a number of stars)

  function message(title, text) {
    root.innerHTML = `<h1>${title}</h1><p>${text}</p>`;
  }

  async function save(values) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'avis', form: formId, email, vid, answers: values }),
      keepalive: true,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
  }

  function question(q, i) {
    let control = '';
    if (q.type === 'choice') {
      control = `<div class="avis-options">${q.options.map(o => `
        <button type="button" class="poll-option" data-q="${q.id}" data-v="${esc(o)}" aria-pressed="false"><span class="poll-label">${esc(o)}</span></button>`).join('')}
      </div>`;
      if (q.id === 'partage') control += `
        <div class="avis-name" hidden>
          <label for="avis-name">Ton prénom</label>
          <input id="avis-name" type="text" autocomplete="given-name" maxlength="60" value="${esc(name)}">
        </div>`;
    } else if (q.type === 'stars') {
      control = `<div class="avis-stars" role="radiogroup" aria-label="${esc(q.label)}">${[1, 2, 3, 4, 5].map(n => `
        <button type="button" class="avis-star" data-q="${q.id}" data-v="${n}" role="radio" aria-checked="false" aria-label="${n} étoile${n > 1 ? 's' : ''}">${star}</button>`).join('')}
      </div>`;
    } else {
      control = `<textarea class="avis-textarea" data-q="${q.id}" maxlength="2000" rows="4" placeholder="${esc(q.placeholder || '')}" aria-labelledby="avis-q${i}"></textarea>`;
    }
    return `<fieldset class="avis-q" id="q-${q.id}">
      <legend class="avis-label" id="avis-q${i}">${i + 1} · ${esc(q.label)}</legend>
      ${q.hint ? `<p class="avis-hint">${esc(q.hint)}</p>` : ''}
      ${control}
      <p class="avis-missing" hidden>Il manque ta réponse ici.</p>
    </fieldset>`;
  }

  // Shows the chosen option, stars and the first-name box for the current answers.
  function show() {
    root.querySelectorAll('.poll-option[data-q]').forEach(b => {
      const on = answers[b.dataset.q] === b.dataset.v;
      b.classList.toggle('mine', on);
      b.setAttribute('aria-pressed', on);
    });
    root.querySelectorAll('.avis-star').forEach(b => {
      const n = Number(b.dataset.v);
      b.classList.toggle('on', n <= (answers[b.dataset.q] || 0));
      b.setAttribute('aria-checked', n === answers[b.dataset.q]);
    });
    const nameBox = root.querySelector('.avis-name');
    if (nameBox) nameBox.hidden = answers.partage !== SHARE_WITH_NAME;
  }

  function render() {
    root.innerHTML = `
      <h1>${esc(form.title)}</h1>
      ${form.intro ? `<p class="avis-intro">${esc(form.intro)}</p>` : ''}
      <form class="avis-form" novalidate>
        ${form.questions.map(question).join('')}
        <p class="avis-privacy">${esc(form.privacy)} <a href="mailto:${esc(form.contact)}">${esc(form.contact)}</a>.</p>
        <p class="error" role="alert" hidden>Oups, ton avis n’a pas pu être envoyé. Tu peux réessayer${NB}?</p>
        <button class="btn" type="submit">Envoyer</button>
      </form>`;
    show();

    root.addEventListener('click', e => {
      const b = e.target.closest('[data-q][data-v]');
      if (!b) return;
      const q = form.questions.find(x => x.id === b.dataset.q);
      answers[q.id] = q.type === 'stars' ? Number(b.dataset.v) : b.dataset.v;
      root.querySelector(`#q-${q.id} .avis-missing`).hidden = true;
      show();
    });
    root.addEventListener('input', e => {
      if (e.target.dataset.q) root.querySelector(`#q-${e.target.dataset.q} .avis-missing`).hidden = true;
    });
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); send(); });
  }

  async function send() {
    root.querySelectorAll('.avis-textarea').forEach(t => { answers[t.dataset.q] = t.value.trim(); });
    const missing = form.questions.filter(q => !answers[q.id]);
    root.querySelectorAll('.avis-missing').forEach(p => { p.hidden = true; });
    if (missing.length) {
      missing.forEach(q => { root.querySelector(`#q-${q.id} .avis-missing`).hidden = false; });
      root.querySelector(`#q-${missing[0].id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const values = { ...answers };
    const nameInput = root.querySelector('#avis-name');
    if (nameInput && answers.partage === SHARE_WITH_NAME && nameInput.value.trim()) values['prénom'] = nameInput.value.trim();

    // The peony waits while the answers are sent. The form is set aside, not
    // destroyed, so it comes back as it was if sending fails.
    const page = [...root.childNodes];
    root.innerHTML = waiting;
    window.scrollTo(0, 0);
    try {
      await save(values);
      await fontsReady;
      root.innerHTML = `<h1>Merci pour ton <mark>avis</mark></h1>${form.thanks ? `<p class="hand">${esc(form.thanks)}</p>` : ''}`;
    } catch {
      root.replaceChildren(...page);
      root.querySelector('.error').hidden = false;
    }
  }

  async function start() {
    if (!formId) return message('Formulaire introuvable', `Ce lien semble incomplet.`);
    root.innerHTML = waiting;
    try {
      const [forms, config] = await Promise.all([
        fetch('data/avis.json').then(r => r.json()),
        fetch('data/sondage.json').then(r => r.json()),
      ]);
      form = forms[formId];
      endpoint = config.endpoint;
    } catch {
      return message('Oups', `Impossible d’ouvrir le formulaire. Vérifie ta connexion, puis recharge la page.`);
    }
    if (!form) return message('Formulaire introuvable', `Ce formulaire n’existe plus, ou le lien est incomplet.`);

    // The answer tapped in the email is saved right away, so it counts even if
    // the rest of the form is never sent.
    const q = form.questions[0];
    const first = q.type === 'stars' ? (firstAnswer >= 1 && firstAnswer <= 5 ? firstAnswer : null)
      : q.type === 'choice' ? q.options[firstAnswer - 1] || null : null;
    if (first) {
      answers[q.id] = first;
      const values = { [q.id]: first };
      if (name) values['prénom'] = name;
      save(values).catch(() => { /* sent again with the rest of the form */ });
    }
    render();
  }

  start();
})();
