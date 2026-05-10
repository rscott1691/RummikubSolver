// ── State ─────────────────────────────────────────────────────────────────────
const COLOURS = ['k', 'b', 'o', 'r'];
const COLOUR_NAMES = { k: 'Black', b: 'Blue', o: 'Orange', r: 'Red' };

// hand and board are arrays of tile codes, e.g. ['r5', 'b5', 'k5']
let hand = [];
let board = [];
let mode = 'hand'; // 'hand' or 'board'
let maxJokers = 2;

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('variant').addEventListener('change', function () {
  maxJokers = this.value === '6player' ? 4 : 2;
  renderPicker();
  hand = [];
  board = [];
  renderTray('hand');
  renderTray('board');
});

window.addEventListener('DOMContentLoaded', () => {
  renderPicker();
});

// ── Tile Picker ───────────────────────────────────────────────────────────────
function renderPicker() {
  const container = document.getElementById('tile-picker');
  container.innerHTML = '';

  // One row per colour
  COLOURS.forEach(c => {
    const row = document.createElement('div');
    row.className = 'color-row';

    const label = document.createElement('span');
    label.className = 'color-label';
    label.textContent = COLOUR_NAMES[c];
    row.appendChild(label);

    for (let n = 1; n <= 13; n++) {
      row.appendChild(makeTileBtn(`${c}${n}`, String(n), c));
    }
    container.appendChild(row);
  });

  // Joker row
  const jokerRow = document.createElement('div');
  jokerRow.className = 'color-row';
  const jokerLabel = document.createElement('span');
  jokerLabel.className = 'color-label';
  jokerLabel.textContent = 'Joker';
  jokerRow.appendChild(jokerLabel);
  for (let i = 0; i < maxJokers; i++) {
    jokerRow.appendChild(makeTileBtn('j', 'J', 'j'));
  }
  container.appendChild(jokerRow);
}

function makeTileBtn(code, label, colour) {
  const btn = document.createElement('button');
  btn.className = `tile-btn color-${colour}`;
  btn.dataset.code = code;
  btn.textContent = label;
  btn.onclick = () => addTile(code);
  updateTileBtn(btn, code);
  return btn;
}

function updateTileBtn(btn, code) {
  const used = countCode(code, hand) + countCode(code, board);
  const limit = code === 'j' ? maxJokers : 2;
  btn.classList.remove('used-1', 'used-2');

  // remove old badge if present
  const old = btn.querySelector('.badge');
  if (old) old.remove();

  if (used >= limit) {
    btn.classList.add('used-2');
  } else if (used === 1) {
    btn.classList.add('used-1');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '1';
    btn.appendChild(badge);
  }
}

function refreshPickerBtn(code) {
  document.querySelectorAll(`.tile-btn[data-code="${code}"]`).forEach(btn => {
    updateTileBtn(btn, code);
  });
}

// ── Adding / Removing Tiles ───────────────────────────────────────────────────
function addTile(code) {
  const used = countCode(code, hand) + countCode(code, board);
  const limit = code === 'j' ? maxJokers : 2;
  if (used >= limit) return;

  if (mode === 'hand') hand.push(code);
  else board.push(code);

  renderTray(mode);
  refreshPickerBtn(code);
}

function removeTile(code, tray) {
  const arr = tray === 'hand' ? hand : board;
  const idx = arr.lastIndexOf(code);
  if (idx !== -1) arr.splice(idx, 1);
  renderTray(tray);
  refreshPickerBtn(code);
}

function clearTray(tray) {
  const codes = tray === 'hand' ? [...hand] : [...board];
  if (tray === 'hand') hand = [];
  else board = [];
  renderTray(tray);
  codes.forEach(c => refreshPickerBtn(c));
}

// ── Render Tray ───────────────────────────────────────────────────────────────
function renderTray(tray) {
  const arr = tray === 'hand' ? hand : board;
  const container = document.getElementById(`${tray}-tray`);
  const countEl = document.getElementById(`${tray}-count`);

  container.innerHTML = '';
  countEl.textContent = `${arr.length} tile${arr.length !== 1 ? 's' : ''}`;

  if (arr.length === 0) {
    container.innerHTML = '<span class="empty-msg">No tiles added yet.</span>';
    return;
  }

  // Sort for display: colour then number
  const sorted = [...arr].sort();
  sorted.forEach(code => {
    const colour = code === 'j' ? 'j' : code[0];
    const num = code === 'j' ? 'J' : code.slice(1);
    const chip = document.createElement('div');
    chip.className = `tray-tile color-${colour}`;
    chip.innerHTML = `${num}<button class="remove-btn" title="Remove">×</button>`;
    chip.querySelector('.remove-btn').onclick = () => removeTile(code, tray);
    container.appendChild(chip);
  });
}

// ── Mode Switch ───────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('mode-hand').classList.toggle('active', m === 'hand');
  document.getElementById('mode-board').classList.toggle('active', m === 'board');
}

// ── Solve ─────────────────────────────────────────────────────────────────────
async function solve() {
  if (hand.length === 0) {
    alert('Add some tiles to your hand first.');
    return;
  }

  const btn = document.getElementById('solve-btn');
  btn.disabled = true;
  btn.textContent = 'Solving…';

  const payload = {
    variant: document.getElementById('variant').value,
    rack: hand,
    table: board,
    initial_meld: document.getElementById('initial-meld').checked,
  };

  try {
    const resp = await fetch('/api/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    showResults(data);
  } catch (err) {
    showResults({ success: false, error: 'Could not reach the server.' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Find Best Move';
  }
}

// ── Results ───────────────────────────────────────────────────────────────────
function showResults(data) {
  const section = document.getElementById('results-section');
  const content = document.getElementById('results-content');
  section.classList.remove('hidden');
  content.innerHTML = '';

  if (!data.success || !data.can_play) {
    const msg = document.createElement('p');
    msg.className = 'no-move';
    msg.textContent = data.message || data.error || 'No valid move found.';
    content.appendChild(msg);
    return;
  }

  const summary = document.createElement('p');
  summary.className = 'move-summary';
  summary.textContent = `You can play ${data.tile_count} tile${data.tile_count !== 1 ? 's' : ''}!`;
  content.appendChild(summary);

  const playedSet = new Set(data.tiles_played);

  const list = document.createElement('div');
  list.className = 'sets-list';

  data.sets.forEach((set, i) => {
    const row = document.createElement('div');
    row.className = 'set-row';

    const lbl = document.createElement('span');
    lbl.className = 'set-label';
    lbl.textContent = `Set ${i + 1}`;
    row.appendChild(lbl);

    set.forEach(code => {
      const colour = code === 'j' ? 'j' : code[0];
      const num = code === 'j' ? 'J' : code.slice(1);
      const tile = document.createElement('span');
      tile.className = `result-tile color-${colour}`;
      if (playedSet.has(code)) tile.classList.add('from-rack');
      tile.textContent = num;
      tile.title = code;
      row.appendChild(tile);
    });

    list.appendChild(row);
  });

  content.appendChild(list);

  const note = document.createElement('p');
  note.style.cssText = 'font-size:0.8rem;color:#888;margin-top:10px;';
  note.textContent = 'Gold outline = tile from your hand. No outline = tile already on the board.';
  content.appendChild(note);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function countCode(code, arr) {
  return arr.filter(c => c === code).length;
}
