// Papier Pivoine companion app: a small hash router over data/books.json.
// Everything the reader does (unlocked books, colors, writing) stays in
// localStorage on her own device.
(() => {
  const app = document.getElementById('app');
  const NB = ' '; // narrow no-break space before ? ! : ;
  let data = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  const isUnlocked = id => store.get('pp:unlocked', []).includes(id);
  const unlock = id => store.set('pp:unlocked', [...new Set([...store.get('pp:unlocked', []), id])]);

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const normalizeAnswer = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function cover(book) {
    return `<div class="cover" style="background:${esc(book.coverColor)}">
      <div class="fallback">${esc(book.title)}</div>
      <img src="${esc(book.cover)}" alt="Couverture de ${esc(book.title)}" onerror="this.remove()">
    </div>`;
  }

  function newsletterCta() {
    const n = data.newsletter;
    return `<div class="cta">
      <p class="hand">(et si tu veux un peu plus d’écriture douce)</p>
      <a class="btn" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.text)} →</a>
    </div>`;
  }

  // ---------- Views ----------

  function home() {
    const shelf = data.books.map(b => `
      <a class="book" href="#/livre/${b.id}">
        ${cover(b)}
        <span class="meta"><strong>${esc(b.title)}</strong>${esc(b.collection)}</span>
        <span class="badge ${isUnlocked(b.id) ? '' : 'locked'}">${isUnlocked(b.id) ? 'Ouvert' : 'À débloquer'}</span>
      </a>`).join('');
    const soon = data.comingSoon.map(s => `
      <div class="book soon">
        <div class="cover"><span class="hand">bientôt</span></div>
        <span class="meta"><strong>${esc(s.title)}</strong>${esc(s.note)}</span>
      </div>`).join('');
    return `
      <section class="intro">
        <h1>Les bonus de <mark>tes carnets</mark></h1>
        <p>Des pages à imprimer, des coloriages, des mots mêlés et des pages d’écriture en plus. Une page quand tu veux.</p>
        <p class="hand">(tout reste sur ton téléphone, rien que pour toi)</p>
      </section>
      <section class="shelf" aria-label="Ma bibliothèque">${shelf}${soon}</section>
      ${newsletterCta()}`;
  }

  function unlockView(book) {
    return `
      <a class="back" href="#/">← Ma bibliothèque</a>
      <div class="book-head">${cover(book)}<div><h2 class="title-it">${esc(book.title)}</h2><p class="muted">${esc(book.tagline)}</p></div></div>
      <form class="card" id="unlock">
        <label for="answer">${esc(book.unlock.question)}</label>
        <input id="answer" type="text" autocomplete="off" autocapitalize="off" required>
        <div class="row">
          <button class="btn" type="submit">Ouvrir mes bonus</button>
          <span class="error" role="alert" hidden>Ce n’est pas tout à fait ça. Tu regardes la bonne page${NB}?</span>
        </div>
      </form>
      <p class="muted">Tu n’as pas encore le carnet${NB}? <a href="${esc(book.shopUrl)}" target="_blank" rel="noopener">Découvre-le ici</a>.</p>`;
  }

  function bookView(book) {
    return `
      <a class="back" href="#/">← Ma bibliothèque</a>
      <div class="book-head">${cover(book)}<div><h2 class="title-it">${esc(book.title)}</h2><p class="muted">${esc(book.collection)}</p></div></div>
      <nav class="tiles">
        <a class="tile" href="#/livre/${book.id}/imprimer"><h3>À imprimer</h3><span class="hand">les pages en plus</span></a>
        <a class="tile" href="#/livre/${book.id}/colorier"><h3>Colorier</h3><span class="hand">sur l’écran, du bout du doigt</span></a>
        <a class="tile" href="#/livre/${book.id}/jeu"><h3>Mots mêlés</h3><span class="hand">une grille, une tasse</span></a>
        <a class="tile" href="#/livre/${book.id}/ecrire"><h3>Écrire</h3><span class="hand">rien que pour toi</span></a>
      </nav>
      ${newsletterCta()}`;
  }

  const backTo = book => `<a class="back" href="#/livre/${book.id}">← <span class="title-it">${esc(book.title)}</span></a>`;

  function printablesView(book) {
    const items = book.printables.map(p => `
      <li>
        <strong>${esc(p.title)}</strong><br><span class="muted">${esc(p.note)}</span>
        <div class="row">${p.file
          ? `<a class="btn" href="${esc(p.file)}" download>Télécharger le PDF</a>`
          : `<span class="badge locked">Bientôt</span>`}</div>
      </li>`).join('');
    return `${backTo(book)}<h1>À <mark>imprimer</mark></h1><div class="card"><ul class="list">${items}</ul></div>`;
  }

  function coloringListView(book) {
    const items = book.coloring.map(id => `
      <li><a href="#/livre/${book.id}/colorier/${id}"><strong>${esc(Coloring.PAGES[id].title)}</strong></a></li>`).join('');
    return `${backTo(book)}<h1><mark>Colorier</mark></h1>
      <p>Choisis une couleur, puis touche une forme. Tes couleurs restent là quand tu reviens.</p>
      <div class="card"><ul class="list">${items}</ul></div>`;
  }

  function coloringView(book, pageId) {
    return `${backTo(book)}<h2>${esc(Coloring.PAGES[pageId].title)}</h2><div id="coloring"></div>`;
  }

  function gameView(book) {
    return `${backTo(book)}<h1>Mots <mark>mêlés</mark></h1>
      <p>Glisse le doigt de la première à la dernière lettre.</p>
      <div id="ws"></div>
      <p class="hand" id="ws-done" hidden>Tout trouvé. (Bao approuve)</p>
      <div class="row"><button class="btn ghost" id="ws-new">Une nouvelle grille</button></div>`;
  }

  function writeView(book) {
    const pages = store.get(`pp:write:${book.id}`, {});
    const items = book.prompts.map((p, i) => `
      <div class="card">
        <label for="w${i}">${esc(p)}</label>
        <textarea id="w${i}" data-i="${i}">${esc(pages[i] || '')}</textarea>
        <span class="saved" id="s${i}">enregistré</span>
      </div>`).join('');
    return `${backTo(book)}<h1><mark>Écrire</mark></h1>
      <p>Une question, quelques lignes. Personne d’autre ne les lit.</p>
      ${items}
      <div class="row"><button class="btn ghost" id="export">Garder une copie (.txt)</button></div>`;
  }

  // ---------- Behaviour after render ----------

  function wireUnlock(book) {
    document.getElementById('unlock').addEventListener('submit', async e => {
      e.preventDefault();
      const answer = normalizeAnswer(document.getElementById('answer').value);
      if (await sha256(answer) === book.unlock.answerHash) {
        unlock(book.id);
        render();
      } else {
        document.querySelector('#unlock .error').hidden = false;
      }
    });
  }

  function wireWrite(book) {
    const key = `pp:write:${book.id}`;
    let timer;
    app.querySelectorAll('textarea').forEach(t => t.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const pages = store.get(key, {});
        pages[t.dataset.i] = t.value;
        store.set(key, pages);
        const s = document.getElementById(`s${t.dataset.i}`);
        s.classList.add('show');
        setTimeout(() => s.classList.remove('show'), 1200);
      }, 400);
    }));
    document.getElementById('export').addEventListener('click', () => {
      const pages = store.get(key, {});
      const text = book.prompts.map((p, i) => `${p}\n\n${pages[i] || ''}\n`).join('\n---\n\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      a.download = `papier-pivoine-${book.id}-mes-pages.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  function wireGame(book) {
    const start = () => {
      document.getElementById('ws-done').hidden = true;
      WordSearch.mount(document.getElementById('ws'), book.words, () => {
        document.getElementById('ws-done').hidden = false;
      });
    };
    document.getElementById('ws-new').addEventListener('click', start);
    start();
  }

  // ---------- Router ----------

  function render() {
    const [, section, id, sub, extra] = location.hash.replace(/^#/, '').split('/');
    const book = section === 'livre' && data.books.find(b => b.id === id);

    if (!book) {
      app.innerHTML = home();
    } else if (!isUnlocked(book.id)) {
      app.innerHTML = unlockView(book);
      wireUnlock(book);
    } else if (sub === 'imprimer') {
      app.innerHTML = printablesView(book);
    } else if (sub === 'colorier' && Coloring.PAGES[extra] && book.coloring.includes(extra)) {
      app.innerHTML = coloringView(book, extra);
      Coloring.mount(document.getElementById('coloring'), book.id, extra);
    } else if (sub === 'colorier') {
      app.innerHTML = coloringListView(book);
    } else if (sub === 'jeu') {
      app.innerHTML = gameView(book);
      wireGame(book);
    } else if (sub === 'ecrire') {
      app.innerHTML = writeView(book);
      wireWrite(book);
    } else {
      app.innerHTML = bookView(book);
    }
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  fetch('data/books.json')
    .then(r => r.json())
    .then(json => { data = json; render(); window.addEventListener('hashchange', render); })
    .catch(() => { app.innerHTML = '<p>Oups, la page n’a pas pu se charger. Tu réessaies dans un instant ?</p>'; });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
