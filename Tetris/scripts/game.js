const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');

const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

// Scale for drawing
const scale = 20;
context.scale(scale, scale);
nextCtx.scale(scale / 2, scale / 2);

// Grid size
const COLS = 12;
const ROWS = 20;

// Create matrix (empty grid)
function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

// Tetromino shapes and colors
const tetrominoes = {
  'I': [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]],
  'O': [
    [2, 2],
    [2, 2]
  ],
  'T': [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0]
  ],
  'S': [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0]
  ],
  'Z': [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0]
  ],
  'J': [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  'L': [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0]
  ]
};

// Corresponding colors
const blockColors = {
  1: '#FF595E', // red
  2: '#FFCA3A', // yellow
  3: '#8AC926', // green
  4: '#1982C4', // blue
  5: '#6A4C93', // purple
  6: '#FF924C', // orange
  7: '#00C2D1'  // cyan
};

// Random Tetromino
function randomTetromino() {
  const keys = Object.keys(tetrominoes);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const matrix = tetrominoes[type];

  const flat = matrix.flat();
  const colorId = flat.find(v => v !== 0);
  const color = blockColors[colorId];

  return {
    type,
    matrix,
    rotationIndex: 0,
    color,
    pos: { x: 0, y: 0 }
  };
}

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  color: null,
  type: '',
  rotationIndex: 0,
  next: randomTetromino()
};

// Main game state
const arena = createMatrix(COLS, ROWS);
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let score = 0;
let isPaused = true;
let rafId = null;

// Draw a matrix (block shape) on the canvas
function drawMatrix(matrix, offset, colorOverride, ctx = context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colorOverride || blockColors[value] || '#999';
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        ctx.strokeStyle = '#ffffff30';
        ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

// Merge the current piece into the arena
function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        arena[y + player.pos.y][x + player.pos.x] = player.color;
      }
    });
  });
}

// Clear filled rows
function sweepArena() {
  let lines = 0;
  for (let y = arena.length - 1; y >= 0; y--) {
    if (arena[y].every(cell => cell !== 0)) {
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      y++;
      lines++;
    }
  }

  if (lines > 0) {
    score += lines * 10;
    updateScore();
    increaseDifficulty();
  }
}

// Collision detection
function collide(arena, player) {
  const { matrix, pos } = player;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (
        matrix[y][x] &&
        (arena[y + pos.y] && arena[y + pos.y][x + pos.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

// Player drop
function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    resetPlayer();
    sweepArena();
  }
  dropCounter = 0;
}

// Hard drop - instantly drop to bottom
function playerHardDrop() {
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  resetPlayer();
  sweepArena();
  dropCounter = 0;
}

// Move player horizontally
function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const rotated = [];
  for (let y = 0; y < size; y++) {
    rotated[y] = [];
    for (let x = 0; x < size; x++) {
      rotated[y][x] = matrix[size - x - 1][y];
    }
  }
  return rotated;
}

// Rotate the tetromino
function playerRotate() {
  const originalMatrix = player.matrix;
  const rotated = rotateMatrix(originalMatrix);

  const prevX = player.pos.x;
  let offset = 1;
  player.matrix = rotated;

  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      player.matrix = originalMatrix;
      player.pos.x = prevX;
      return;
    }
  }
}

// Reset to next piece
function resetPlayer() {
  const next = player.next;
  player.matrix = next.matrix;
  player.type = next.type;
  player.color = next.color;
  player.rotationIndex = next.rotationIndex;
  player.pos.y = 0;
  player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
  player.next = randomTetromino();

  drawNext();
  if (collide(arena, player)) {
    arena.forEach(row => row.fill(0));
    score = 0;
    updateScore();
    showGameOverPopup();
    isPaused = true;
  }
}

// Draw the full game
function draw() {
  context.fillStyle = '#f0f8ff';
  context.fillRect(0, 0, canvas.width / scale, canvas.height / scale);

  drawMatrix(arena, { x: 0, y: 0 }, null);
  drawMatrix(player.matrix, player.pos, player.color);
}

// Draw the next tetromino
function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawMatrix(player.next.matrix, { x: 1, y: 1 }, player.next.color, nextCtx);
}

// Score update
function updateScore() {
  document.getElementById('score').innerText = score;
}

// Increase speed based on score
function increaseDifficulty() {
  dropInterval = Math.max(200, 1000 - score * 5);
}

// Game loop
function update(time = 0) {
  if (isPaused) return;
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  rafId = requestAnimationFrame(update);
}

// Keyboard Controls
document.addEventListener('keydown', (e) => {
  if (isPaused) return;
  
  if (e.key === 'ArrowLeft') {
    playerMove(-1);
  } else if (e.key === 'ArrowRight') {
    playerMove(1);
  } else if (e.key === 'ArrowDown') {
    playerDrop();
  } else if (e.key === 'ArrowUp' || e.key === ' ') {
    playerRotate();
  }
});

// Touch Controls
let touchStartX = null;
let touchStartY = null;
let touchMoved = false;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchMoved = false;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchStartX || !touchStartY || isPaused) return;

  const touch = e.touches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
    touchMoved = true;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 30) {
        playerMove(1);
        touchStartX = touch.clientX;
      } else if (deltaX < -30) {
        playerMove(-1);
        touchStartX = touch.clientX;
      }
    } else {
      if (deltaY > 30) {
        playerDrop();
        touchStartY = touch.clientY;
      }
    }
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!touchMoved && touchStartX !== null && touchStartY !== null && !isPaused) {
    playerRotate();
  }
  touchStartX = null;
  touchStartY = null;
  touchMoved = false;
});

// UI Buttons
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

startBtn.addEventListener('click', () => {
  if (isPaused) {
    isPaused = false;
    if (!player.matrix) {
      resetPlayer();
    }
    update();
  }
});

pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  if (isPaused) {
    cancelAnimationFrame(rafId);
  } else {
    update();
  }
});

resetBtn.addEventListener('click', () => {
  arena.forEach(row => row.fill(0));
  score = 0;
  updateScore();
  resetPlayer();
  draw();
  isPaused = true;
  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.textContent = 'Pause';
});

// Mobile Controls
document.getElementById('mobileLeft').addEventListener('click', () => {
  if (!isPaused) playerMove(-1);
});

document.getElementById('mobileRight').addEventListener('click', () => {
  if (!isPaused) playerMove(1);
});

document.getElementById('mobileRotate').addEventListener('click', () => {
  if (!isPaused) playerRotate();
});

document.getElementById('mobileDrop').addEventListener('click', () => {
  if (!isPaused) playerHardDrop();
});

document.getElementById('mobilePause').addEventListener('click', () => {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  if (isPaused) {
    cancelAnimationFrame(rafId);
  } else {
    update();
  }
});

// Lock Scroll Button
let scrollLocked = false;
const lockScrollBtn = document.getElementById('lockScrollBtn');

lockScrollBtn.addEventListener('click', () => {
  scrollLocked = !scrollLocked;
  if (scrollLocked) {
    document.body.classList.add('scroll-locked');
    lockScrollBtn.textContent = '🔒 LOCKED SCROLL';
    lockScrollBtn.classList.add('locked');
  } else {
    document.body.classList.remove('scroll-locked');
    lockScrollBtn.textContent = '🔓 UNLOCK SCROLL';
    lockScrollBtn.classList.remove('locked');
  }
});

// Prevent scrolling when locked
document.addEventListener('touchmove', (e) => {
  if (scrollLocked) {
    e.preventDefault();
  }
}, { passive: false });

// Touch hint
function showTouchHint() {
  if (window.innerWidth <= 768) {
    document.getElementById('touchHint').classList.add('show');
  }
}

function hideTouchHint() {
  document.getElementById('touchHint').classList.remove('show');
}

function showGameOverPopup() {
  const div = document.createElement("div");
  div.innerHTML = `
    <h2>Game Over!</h2>
    <p>Score: ${score}</p>
    <button onclick="location.reload()">Restart</button>
  `;
  div.style = `
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px 30px;
    box-shadow: 0 0 15px rgba(0,0,0,0.5);
    border-radius: 12px;
    text-align: center;
    z-index: 10000;
    font-family: sans-serif;
  `;
  document.body.appendChild(div);
}

// Initialize
resetPlayer();
draw();
drawNext();

// Show touch hint on mobile
window.addEventListener('load', () => {
  setTimeout(showTouchHint, 1000);
});