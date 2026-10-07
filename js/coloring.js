// Tap-to-fill coloring pages built from the Papier Pivoine signature peony.
// Each region is one closed path: its fill and its outline are the same path.
const Coloring = (() => {
  const CENTER = 'M62.7,49.8 C66.1,48.3 73.1,61.7 69.5,62.6 C71.8,66.2 60.0,73.3 57.4,69.7 C53.2,71.8 46.4,60.3 50.3,57.4 C49.8,53.3 61.7,47.9 62.7,51.8 Z';
  const PETALS = [
    'M57.1,43.6 C46.3,12.7 80.5,14.0 65.0,44.5 Z',
    'M69.6,46.7 C81.8,18.7 103.5,44.8 74.8,52.4 Z',
    'M77.3,59.3 C107.0,50.6 98.2,86.2 75.1,67.9 Z',
    'M71.5,72.6 C98.7,90.0 68.7,109.6 64.6,76.1 Z',
    'M56.0,75.8 C55.5,106.4 22.2,90.6 49.0,71.4 Z',
    'M46.0,67.6 C19.3,88.3 11.6,52.1 44.5,60.0 Z',
    'M44.9,52.5 C15.6,45.7 36.2,19.9 49.7,47.0 Z',
  ];

  const SWATCHES = ['#E26D5F', '#F6DCD4', '#F2C66D', '#EDBB85', '#AFC2D8', '#9AA8B8', '#A9B97F', '#9C6B4A', '#2B2521', '#FFFFFF'];

  function peony(prefix, transform) {
    return `<g transform="${transform}">
      ${PETALS.map((d, i) => `<path data-region="${prefix}p${i}" d="${d}"/>`).join('')}
      <path data-region="${prefix}c" d="${CENTER}"/>
    </g>`;
  }

  const PAGES = {
    pivoine: {
      title: 'La grande pivoine',
      svg: () => `
        <rect data-region="bg" x="2" y="2" width="356" height="356" rx="16"/>
        <circle data-region="ring" cx="180" cy="180" r="160"/>
        ${peony('', 'translate(-30 -30) scale(3.5)')}`,
    },
    bouquet: {
      title: 'Le cercle de pivoines',
      svg: () => {
        const ring = Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
          const x = 180 + Math.cos(a) * 115, y = 180 + Math.sin(a) * 115;
          return peony(`r${i}`, `translate(${x - 51} ${y - 51}) scale(0.85) rotate(${i * 51} 60 60)`);
        }).join('');
        return `
          <rect data-region="bg" x="2" y="2" width="356" height="356" rx="16"/>
          <circle data-region="outer" cx="180" cy="180" r="170"/>
          <circle data-region="inner" cx="180" cy="180" r="60"/>
          ${ring}
          ${peony('m', 'translate(132 132) scale(0.8)')}`;
      },
    },
  };

  function storageKey(bookId, pageId) { return `pp:color:${bookId}:${pageId}`; }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
  }
  function save(key, fills) {
    try { localStorage.setItem(key, JSON.stringify(fills)); } catch { /* private mode */ }
  }

  function mount(root, bookId, pageId) {
    const page = PAGES[pageId];
    const key = storageKey(bookId, pageId);
    const fills = load(key);
    let color = SWATCHES[0];

    root.innerHTML = `
      <div class="swatches" role="group" aria-label="Couleurs">
        ${SWATCHES.map((c, i) => `<button class="swatch" style="background:${c}" data-color="${c}"
          aria-label="Couleur ${i + 1}" aria-pressed="${i === 0}"></button>`).join('')}
      </div>
      <div class="coloring-wrap">
        <svg viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
          <g fill="#FFFFFF" stroke="#2B2521" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            ${page.svg()}
          </g>
        </svg>
      </div>
      <div class="row">
        <button class="btn" data-act="png">Enregistrer en image</button>
        <button class="btn ghost" data-act="reset">Tout effacer</button>
      </div>`;

    const svg = root.querySelector('svg');
    svg.querySelectorAll('[data-region]').forEach(el => {
      if (fills[el.dataset.region]) el.setAttribute('fill', fills[el.dataset.region]);
    });

    root.querySelector('.swatches').addEventListener('click', e => {
      const btn = e.target.closest('.swatch');
      if (!btn) return;
      color = btn.dataset.color;
      root.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s === btn));
    });

    svg.addEventListener('click', e => {
      const region = e.target.closest('[data-region]');
      if (!region) return;
      region.setAttribute('fill', color);
      fills[region.dataset.region] = color;
      save(key, fills);
    });

    root.querySelector('[data-act=reset]').addEventListener('click', () => {
      if (!confirm('Effacer toutes les couleurs de cette page ?')) return;
      svg.querySelectorAll('[data-region]').forEach(el => el.setAttribute('fill', '#FFFFFF'));
      for (const k of Object.keys(fills)) delete fills[k];
      save(key, fills);
    });

    root.querySelector('[data-act=png]').addEventListener('click', () => exportPng(svg, `papier-pivoine-${pageId}.png`));
  }

  function exportPng(svg, filename) {
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1440;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
  }

  return { PAGES, mount };
})();
