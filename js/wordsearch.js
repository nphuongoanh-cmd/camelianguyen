// Word search ("mots mêlés"): builds a grid from a word list, lets the player
// drag from the first to the last letter of a word.
const WordSearch = (() => {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]];

  function normalize(word) {
    return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  function build(words, size) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(''));
      const placed = [];
      const ok = words.every(word => {
        for (let tries = 0; tries < 200; tries++) {
          const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)];
          const r = Math.floor(Math.random() * size);
          const c = Math.floor(Math.random() * size);
          const endR = r + dr * (word.length - 1);
          const endC = c + dc * (word.length - 1);
          if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
          let fits = true;
          for (let i = 0; i < word.length; i++) {
            const cell = grid[r + dr * i][c + dc * i];
            if (cell && cell !== word[i]) { fits = false; break; }
          }
          if (!fits) continue;
          for (let i = 0; i < word.length; i++) grid[r + dr * i][c + dc * i] = word[i];
          placed.push({ word, r, c, dr, dc });
          return true;
        }
        return false;
      });
      if (!ok) continue;
      for (const row of grid) {
        for (let c = 0; c < size; c++) {
          if (!row[c]) row[c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        }
      }
      return { grid, placed };
    }
    throw new Error('Grille impossible');
  }

  // Cells between two points if they form a straight line, else null.
  function line(a, b) {
    const dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c);
    const len = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c));
    if (b.r - a.r !== dr * len || b.c - a.c !== dc * len) return null;
    return Array.from({ length: len + 1 }, (_, i) => ({ r: a.r + dr * i, c: a.c + dc * i }));
  }

  function mount(root, rawWords, onDone) {
    const words = rawWords.map(normalize);
    const size = Math.max(10, ...words.map(w => w.length));
    const { grid } = build([...words].sort((a, b) => b.length - a.length), size);
    const found = new Set();

    root.innerHTML = `
      <div class="ws-grid" style="grid-template-columns:repeat(${size},1fr)">
        ${grid.map((row, r) => row.map((ch, c) =>
          `<div class="ws-cell" data-r="${r}" data-c="${c}">${ch}</div>`).join('')).join('')}
      </div>
      <ul class="ws-words">${words.map(w => `<li data-word="${w}">${w}</li>`).join('')}</ul>`;

    const gridEl = root.querySelector('.ws-grid');
    const cellAt = (r, c) => gridEl.children[r * size + c];
    let start = null, current = [];

    function cellFromEvent(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !el.classList.contains('ws-cell')) return null;
      return { r: +el.dataset.r, c: +el.dataset.c };
    }
    function paint(cells) {
      current.forEach(p => cellAt(p.r, p.c).classList.remove('sel'));
      current = cells || [];
      current.forEach(p => cellAt(p.r, p.c).classList.add('sel'));
    }

    gridEl.addEventListener('pointerdown', e => {
      start = cellFromEvent(e);
      if (!start) return;
      gridEl.setPointerCapture(e.pointerId);
      paint([start]);
    });
    gridEl.addEventListener('pointermove', e => {
      if (!start) return;
      const here = cellFromEvent(e);
      if (here) paint(line(start, here) || [start]);
    });
    gridEl.addEventListener('pointerup', () => {
      if (!start) return;
      const letters = current.map(p => grid[p.r][p.c]).join('');
      const reversed = [...letters].reverse().join('');
      const match = words.find(w => !found.has(w) && (w === letters || w === reversed));
      if (match) {
        found.add(match);
        current.forEach(p => cellAt(p.r, p.c).classList.add('found'));
        root.querySelector(`[data-word="${match}"]`).classList.add('found');
        if (found.size === words.length && onDone) onDone();
      }
      paint([]);
      start = null;
    });
  }

  return { mount };
})();
