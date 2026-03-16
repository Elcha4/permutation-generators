/* ================================================================
   Permutation Visualizer – app.js
   ================================================================ */

// ── State ──────────────────────────────────────────────────────
let N = 9;
let perm = [];          // perm[i] = card inside box (i+1), stored 1-indexed
let shuffled = false;
let animating = false;  // block interactions during animations

// ── DOM refs ───────────────────────────────────────────────────
const nInput      = document.getElementById('n-input');
const nDisplay    = document.getElementById('n-display');
const shuffleBtn  = document.getElementById('shuffle-btn');
const gridEl      = document.getElementById('grid');
const cyclesContainer = document.getElementById('cycles-container');
const cycleNodes  = document.getElementById('cycle-nodes');
const arrowsSvg   = document.getElementById('arrows-svg');
const tabs        = document.querySelectorAll('.tab');
const pages       = document.querySelectorAll('.page');

// ── Starfield ──────────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.01,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a += s.da;
      if (s.a > 1 || s.a < 0.15) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${s.a.toFixed(2)})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ── Tabs ───────────────────────────────────────────────────────
tabs.forEach(t => t.addEventListener('click', () => {
  if (animating) return;
  tabs.forEach(x => x.classList.remove('active'));
  pages.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab + '-page').classList.add('active');
  if (t.dataset.tab === 'cycles' && shuffled) renderCycles();
}));

// ── N slider ───────────────────────────────────────────────────
nInput.addEventListener('input', () => {
  N = parseInt(nInput.value);
  nDisplay.textContent = N;
  shuffled = false;
  buildGrid();
  clearCycles();
});

// ── Shuffle button ─────────────────────────────────────────────
shuffleBtn.addEventListener('click', () => {
  if (animating) return;
  generatePermutation();
  animateShuffle();
});

// ── Permutation generation (Fisher-Yates) ──────────────────────
function generatePermutation() {
  perm = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
}

// ── Grid rendering ─────────────────────────────────────────────
function buildGrid() {
  const cols = Math.ceil(Math.sqrt(N));
  gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--box-size))`;
  adjustBoxSize();

  gridEl.innerHTML = '';
  for (let i = 1; i <= N; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'box-wrapper';
    wrapper.dataset.index = i;
    wrapper.innerHTML = `
      <div class="box">
        <div class="box-base">
          <span class="box-label">${i}</span>
          <div class="box-card"><span class="card-number"></span></div>
        </div>
        <div class="box-lid"><span class="lid-label">${i}</span></div>
      </div>`;
    wrapper.addEventListener('click', () => openBox(wrapper));
    gridEl.appendChild(wrapper);
  }
}

function adjustBoxSize() {
  const cols = Math.ceil(Math.sqrt(N));
  const maxWidth = Math.min(window.innerWidth - 60, 1060);
  const gap = 10;
  let size = Math.floor((maxWidth - gap * (cols - 1)) / cols);
  size = Math.max(36, Math.min(size, 80));
  document.documentElement.style.setProperty('--box-size', size + 'px');
}

// ── Open / close a box ─────────────────────────────────────────
function openBox(wrapper) {
  if (animating || !shuffled) return;
  if (wrapper.classList.contains('open')) return;

  const idx = parseInt(wrapper.dataset.index);
  const cardNum = wrapper.querySelector('.card-number');
  cardNum.textContent = perm[idx - 1];

  wrapper.classList.add('open');
  setTimeout(() => wrapper.classList.remove('open'), 1500);
}

// ── Shuffle animation ──────────────────────────────────────────
function animateShuffle() {
  animating = true;
  shuffleBtn.disabled = true;

  const wrappers = gridEl.querySelectorAll('.box-wrapper');
  const gridRect = gridEl.getBoundingClientRect();
  const boxSize  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--box-size'));

  // Card offset to center the rectangular card within the box
  const cardW = boxSize * 0.76;
  const cardH = boxSize * 0.84;
  const offX  = (boxSize - cardW) / 2;
  const offY  = (boxSize - cardH) / 2;

  // Phase 0: open all lids to reveal the current cards (identity: card i in box i)
  const floatingCards = [];

  wrappers.forEach((w, i) => {
    w.classList.remove('open');
    // Set card number to identity (card i+1 in box i+1) — before shuffle
    w.querySelector('.card-number').textContent = i + 1;
  });

  // Open lids
  wrappers.forEach(w => w.classList.add('open'));

  // Phase 1: after showing the cards, create floating face-up cards and then flip them
  setTimeout(() => {
    wrappers.forEach((w, i) => {
      const rect = w.getBoundingClientRect();
      const card = document.createElement('div');
      card.className = 'shuffle-card';
      card.innerHTML = `
        <div class="shuffle-card-inner">
          <div class="shuffle-card-face"><span class="card-val">${i + 1}</span></div>
          <div class="shuffle-card-back"></div>
        </div>`;
      card.style.left = (rect.left - gridRect.left + offX) + 'px';
      card.style.top  = (rect.top  - gridRect.top  + offY) + 'px';
      gridEl.appendChild(card);
      floatingCards.push({ el: card, fromIdx: i });
    });

    // Close lids now that floating cards cover them
    wrappers.forEach(w => w.classList.remove('open'));

    // Phase 2: flip all cards face-down
    setTimeout(() => {
      floatingCards.forEach(fc => fc.el.classList.add('flipped'));

      // Phase 3: gather cards to center
      setTimeout(() => {
        const centerX = gridRect.width / 2 - cardW / 2;
        const centerY = gridRect.height / 2 - cardH / 2;

        floatingCards.forEach(fc => {
          const angle = Math.random() * Math.PI * 2;
          const dist  = 20 + Math.random() * 50;
          fc.el.style.left = (centerX + Math.cos(angle) * dist) + 'px';
          fc.el.style.top  = (centerY + Math.sin(angle) * dist) + 'px';
        });

        // Phase 4: slide to final (shuffled) positions
        setTimeout(() => {
          const rects = Array.from(wrappers).map(w => w.getBoundingClientRect());

          floatingCards.forEach((fc, i) => {
            const targetRect = rects[i];
            fc.el.style.left = (targetRect.left - gridRect.left + offX) + 'px';
            fc.el.style.top  = (targetRect.top  - gridRect.top  + offY) + 'px';
          });

          // Phase 5: update hidden card numbers, fade out floating cards, done
          setTimeout(() => {
            // Update card numbers while lids are still closed
            wrappers.forEach((w, i) => {
              w.querySelector('.card-number').textContent = perm[i];
            });

            // Fade out floating cards to reveal closed boxes
            floatingCards.forEach(fc => {
              fc.el.style.opacity = '0';
              setTimeout(() => fc.el.remove(), 300);
            });

            setTimeout(() => {
              shuffled = true;
              animating = false;
              shuffleBtn.disabled = false;

              if (document.getElementById('cycles-page').classList.contains('active')) {
                renderCycles();
              }
            }, 350);
          }, 700);
        }, 700);
      }, 600);
    }, 800);
  }, 700);
}

// ── Cycle decomposition ────────────────────────────────────────
function decomposeCycles() {
  const visited = new Array(N + 1).fill(false);
  const cycles = [];
  for (let i = 1; i <= N; i++) {
    if (visited[i]) continue;
    const cycle = [];
    let cur = i;
    while (!visited[cur]) {
      visited[cur] = true;
      cycle.push(cur);
      cur = perm[cur - 1];
    }
    cycles.push(cycle);
  }
  // Sort cycles: longest first, then by first element
  cycles.sort((a, b) => b.length - a.length || a[0] - b[0]);
  return cycles;
}

// ── Cycle view rendering ───────────────────────────────────────
function clearCycles() {
  cycleNodes.innerHTML = '';
  arrowsSvg.innerHTML = '';
}

function renderCycles() {
  clearCycles();
  if (!shuffled) return;

  const cycles = decomposeCycles();
  const boxSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--box-size'));

  // Layout: place cycles in rows, each cycle arranged as a circle
  const positions = {};  // node -> { x, y }
  const containerWidth = cyclesContainer.clientWidth || 800;

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const padding = 30;
  const cycleGap = 40;

  cycles.forEach(cycle => {
    const len = cycle.length;
    let radius;
    if (len === 1) {
      radius = 0;
    } else if (len === 2) {
      radius = boxSize * 0.9;
    } else {
      // Make the circle big enough that boxes don't overlap
      radius = Math.max((boxSize + 12) / (2 * Math.sin(Math.PI / len)), boxSize * 0.9);
    }

    const diameter = radius * 2 + boxSize;
    const cycleCenterOffset = radius + boxSize / 2;

    // Check if this cycle fits in the current row
    if (cursorX + diameter + padding > containerWidth && cursorX > 0) {
      cursorX = 0;
      cursorY += rowHeight + cycleGap;
      rowHeight = 0;
    }

    const cx = cursorX + cycleCenterOffset + padding;
    const cy = cursorY + cycleCenterOffset + padding + 20;

    cycle.forEach((node, j) => {
      let x, y;
      if (len === 1) {
        x = cx;
        y = cy;
      } else {
        const angle = -Math.PI / 2 + (2 * Math.PI * j) / len;
        x = cx + radius * Math.cos(angle);
        y = cy + radius * Math.sin(angle);
      }
      positions[node] = { x, y };
    });

    cursorX += diameter + cycleGap;
    rowHeight = Math.max(rowHeight, diameter + 30);
  });

  // Set container height
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + boxSize + padding + 20;
  cyclesContainer.style.minHeight = maxY + 'px';

  // Render boxes
  for (let node = 1; node <= N; node++) {
    const pos = positions[node];
    const wrapper = document.createElement('div');
    wrapper.className = 'cycle-box-wrapper';
    wrapper.dataset.index = node;
    wrapper.style.left = (pos.x - boxSize / 2) + 'px';
    wrapper.style.top  = (pos.y - boxSize / 2) + 'px';
    wrapper.innerHTML = `
      <div class="box">
        <div class="box-base">
          <span class="box-label">${node}</span>
          <div class="box-card"><span class="card-number">${perm[node - 1]}</span></div>
        </div>
        <div class="box-lid"><span class="lid-label">${node}</span></div>
      </div>`;
    wrapper.addEventListener('click', () => openBox(wrapper));
    cycleNodes.appendChild(wrapper);
  }

  // Render arrows
  const svgNS = 'http://www.w3.org/2000/svg';

  // Define arrowhead marker
  const defs = document.createElementNS(svgNS, 'defs');

  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const polygon = document.createElementNS(svgNS, 'polygon');
  polygon.setAttribute('points', '0 0, 8 3, 0 6');
  polygon.setAttribute('class', 'arrowhead');
  marker.appendChild(polygon);
  defs.appendChild(marker);

  const markerSelf = document.createElementNS(svgNS, 'marker');
  markerSelf.setAttribute('id', 'arrowhead-self');
  markerSelf.setAttribute('markerWidth', '8');
  markerSelf.setAttribute('markerHeight', '6');
  markerSelf.setAttribute('refX', '8');
  markerSelf.setAttribute('refY', '3');
  markerSelf.setAttribute('orient', 'auto');
  const polygon2 = document.createElementNS(svgNS, 'polygon');
  polygon2.setAttribute('points', '0 0, 8 3, 0 6');
  polygon2.setAttribute('class', 'self-loop-head');
  markerSelf.appendChild(polygon2);
  defs.appendChild(markerSelf);

  arrowsSvg.appendChild(defs);

  cycles.forEach(cycle => {
    const len = cycle.length;

    if (len === 1) {
      // Self-loop
      const node = cycle[0];
      const p = positions[node];
      const r = boxSize * 0.35;
      const path = document.createElementNS(svgNS, 'path');
      // Loop above the box
      const sx = p.x;
      const sy = p.y - boxSize / 2;
      path.setAttribute('d',
        `M ${sx - 6} ${sy} ` +
        `C ${sx - r * 2} ${sy - r * 3}, ${sx + r * 2} ${sy - r * 3}, ${sx + 6} ${sy}`
      );
      path.setAttribute('class', 'self-loop');
      path.setAttribute('marker-end', 'url(#arrowhead-self)');
      arrowsSvg.appendChild(path);
    } else {
      for (let j = 0; j < len; j++) {
        const from = cycle[j];
        const to   = cycle[(j + 1) % len];
        const pf = positions[from];
        const pt = positions[to];

        // Shorten arrow so it doesn't overlap the box
        const dx = pt.x - pf.x;
        const dy = pt.y - pf.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;
        const offset = boxSize / 2 + 6;

        const x1 = pf.x + ux * offset;
        const y1 = pf.y + uy * offset;
        const x2 = pt.x - ux * offset;
        const y2 = pt.y - uy * offset;

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('marker-end', 'url(#arrowhead)');
        arrowsSvg.appendChild(line);
      }
    }
  });
}

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  adjustBoxSize();
  if (document.getElementById('cycles-page').classList.contains('active') && shuffled) {
    renderCycles();
  }
});

buildGrid();
