// ---------------------------------------------------------------------------
// Flappy Bird — Web Edition
// ---------------------------------------------------------------------------
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;   // 600
const H = canvas.height;  // 800
const FLOOR_Y = 730;
const FPS = 60;
const GRAVITY = 0.4;
const JUMP_VEL = -7.5;
const MAX_FALL_VEL = 8;
const PIPE_GAP = 200;
const PIPE_VEL = 3;
const PIPE_SPAWN_X = W + 50;
const PIPE_SPAWN_INTERVAL = 1600; // ms between new pipes
const BASE_VEL = 3;

// Scoring
let score = 0;
let highScore = parseInt(localStorage.getItem("flappyHighScore") || "0", 10);

// ---------------------------------------------------------------------------
// Asset loader
// ---------------------------------------------------------------------------
const ASSETS = {};
const ASSET_LIST = [
  { key: "bird1", src: "imgs/bird1.png" },
  { key: "bird2", src: "imgs/bird2.png" },
  { key: "bird3", src: "imgs/bird3.png" },
  { key: "pipe",  src: "imgs/pipe.png" },
  { key: "bg",    src: "imgs/bg.png" },
  { key: "base",  src: "imgs/base.png" },
];

function loadAssets() {
  return Promise.all(
    ASSET_LIST.map(
      ({ key, src }) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { ASSETS[key] = img; resolve(); };
          img.onerror = () => reject(new Error(`Failed to load ${src}`));
          img.src = src;
        })
    )
  );
}

// ---------------------------------------------------------------------------
// Scaled images (created after load)
// ---------------------------------------------------------------------------
let birdFrames = [];  // 3 images, 2x
let pipeImg, pipeImgTop;
let bgImg;
let baseImg;

function buildScaledAssets() {
  // Scale bird images 2x
  birdFrames = ["bird1", "bird2", "bird3"].map((key) => {
    const src = ASSETS[key];
    const c = document.createElement("canvas");
    c.width = src.width * 2;
    c.height = src.height * 2;
    const cx = c.getContext("2d");
    cx.imageSmoothingEnabled = false;
    cx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  });

  // Scale pipe 2x
  const ps = ASSETS.pipe;
  const pc = document.createElement("canvas");
  pc.width = ps.width * 2;
  pc.height = ps.height * 2;
  const pcx = pc.getContext("2d");
  pcx.imageSmoothingEnabled = false;
  pcx.drawImage(ps, 0, 0, pc.width, pc.height);
  pipeImg = pc;

  // Flipped pipe (top)
  const tc = document.createElement("canvas");
  tc.width = pc.width;
  tc.height = pc.height;
  const tcx = tc.getContext("2d");
  tcx.translate(0, tc.height);
  tcx.scale(1, -1);
  tcx.drawImage(pc, 0, 0);
  pipeImgTop = tc;

  // Background scaled to 600x900
  const bs = ASSETS.bg;
  const bc = document.createElement("canvas");
  bc.width = 600;
  bc.height = 900;
  const bcx = bc.getContext("2d");
  bcx.drawImage(bs, 0, 0, 600, 900);
  bgImg = bc;

  // Base 2x
  const bas = ASSETS.base;
  const bac = document.createElement("canvas");
  bac.width = bas.width * 2;
  bac.height = bas.height * 2;
  const bacx = bac.getContext("2d");
  bacx.imageSmoothingEnabled = false;
  bacx.drawImage(bas, 0, 0, bac.width, bac.height);
  baseImg = bac;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const STATE = { MENU: 0, PLAYING: 1, DEAD: 2 };
let state = STATE.MENU;

// Bird
let bird = { x: 230, y: 350, vel: 0, tilt: 0, frame: 0, frameTick: 0 };

// Pipes
let pipes = [];
let pipeTimer = 0;

// Base scroll
let baseX1 = 0;
let baseX2 = 0; // set after assets load

// Medal flash
let deadTick = 0;

// ---------------------------------------------------------------------------
// Bird
// ---------------------------------------------------------------------------
function resetBird() {
  bird.x = 150;
  bird.y = 350;
  bird.vel = 0;
  bird.tilt = 0;
  bird.frame = 0;
  bird.frameTick = 0;
}

function jumpBird() {
  bird.vel = JUMP_VEL;
}

function updateBird(dt) {
  bird.vel += GRAVITY * dt;
  if (bird.vel > MAX_FALL_VEL) bird.vel = MAX_FALL_VEL;
  bird.y += bird.vel * dt;

  // Tilt
  if (bird.vel < 0) {
    bird.tilt = Math.min(bird.tilt + 3 * dt, 25);
  } else {
    bird.tilt = Math.max(bird.tilt - 1.5 * dt, -90);
  }

  // Animation
  bird.frameTick += dt;
  if (bird.frameTick >= 6) {
    bird.frameTick = 0;
    bird.frame = (bird.frame + 1) % 4;
  }
}

function drawBird() {
  const frameMap = [0, 1, 2, 1]; // animation cycle
  let img = birdFrames[frameMap[bird.frame]];

  // If nose-diving, freeze wing
  if (bird.tilt <= -70) {
    img = birdFrames[1];
  }

  ctx.save();
  ctx.translate(bird.x + img.width / 2, bird.y + img.height / 2);
  ctx.rotate((-bird.tilt * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

function birdRect() {
  const img = birdFrames[0];
  // Slightly smaller hitbox for fairness
  const shrink = 4;
  return {
    x: bird.x + shrink,
    y: bird.y + shrink,
    w: img.width - shrink * 2,
    h: img.height - shrink * 2,
  };
}

// ---------------------------------------------------------------------------
// Pipes
// ---------------------------------------------------------------------------
function spawnPipe() {
  const minH = 80;
  const maxH = FLOOR_Y - PIPE_GAP - minH;
  const topH = minH + Math.random() * (maxH - minH);
  pipes.push({
    x: PIPE_SPAWN_X,
    topH,               // height of the opening from the top
    passed: false,
  });
}

function updatePipes(dt) {
  for (const p of pipes) {
    p.x -= PIPE_VEL * dt;

    // Score
    if (!p.passed && p.x + pipeImg.width < bird.x) {
      p.passed = true;
      score++;
    }
  }

  // Remove off-screen
  if (pipes.length && pipes[0].x + pipeImg.width < -10) {
    pipes.shift();
  }

  // Spawn timer
  pipeTimer += (1000 / 60) * dt;
  if (pipeTimer >= PIPE_SPAWN_INTERVAL) {
    pipeTimer = 0;
    spawnPipe();
  }
}

function drawPipes() {
  for (const p of pipes) {
    // Top pipe (flipped) — bottom of image aligns with topH
    const topY = p.topH - pipeImgTop.height;
    ctx.drawImage(pipeImgTop, p.x, topY);

    // Bottom pipe
    const botY = p.topH + PIPE_GAP;
    ctx.drawImage(pipeImg, p.x, botY);
  }
}

function pipeCollision() {
  const br = birdRect();
  for (const p of pipes) {
    const pw = pipeImg.width;

    // Top pipe rect
    const topY = p.topH - pipeImgTop.height;
    if (rectsOverlap(br, { x: p.x, y: topY, w: pw, h: pipeImgTop.height })) {
      return true;
    }

    // Bottom pipe rect
    const botY = p.topH + PIPE_GAP;
    if (rectsOverlap(br, { x: p.x, y: botY, w: pw, h: pipeImg.height })) {
      return true;
    }
  }
  return false;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------------------------------------------------------------------------
// Base (ground)
// ---------------------------------------------------------------------------
function updateBase(dt) {
  baseX1 -= BASE_VEL * dt;
  baseX2 -= BASE_VEL * dt;
  if (baseX1 + baseImg.width <= 0) baseX1 = baseX2 + baseImg.width;
  if (baseX2 + baseImg.width <= 0) baseX2 = baseX1 + baseImg.width;
}

function drawBase() {
  ctx.drawImage(baseImg, baseX1, FLOOR_Y);
  ctx.drawImage(baseImg, baseX2, FLOOR_Y);
}

// ---------------------------------------------------------------------------
// Collision check
// ---------------------------------------------------------------------------
function checkCollisions() {
  // Floor / ceiling
  const img = birdFrames[0];
  if (bird.y + img.height - 6 >= FLOOR_Y || bird.y < -30) return true;

  // Pipes
  return pipeCollision();
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
function drawScore() {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.font = "bold 56px 'Comic Sans MS', cursive, sans-serif";
  ctx.textAlign = "center";
  const text = `${score}`;
  ctx.strokeText(text, W / 2, 70);
  ctx.fillText(text, W / 2, 70);
}

function drawStartScreen() {
  ctx.drawImage(bgImg, 0, 0);
  drawBase();

  // Title
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 5;
  ctx.font = "bold 64px 'Comic Sans MS', cursive, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText("Flappy Bird", W / 2, 240);
  ctx.fillText("Flappy Bird", W / 2, 240);

  // Subtitle
  ctx.font = "bold 32px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#FFE44D";
  ctx.strokeText("Web Edition", W / 2, 290);
  ctx.fillText("Web Edition", W / 2, 290);

  // High score
  if (highScore > 0) {
    ctx.font = "bold 28px 'Comic Sans MS', cursive, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.strokeText(`Best: ${highScore}`, W / 2, 340);
    ctx.fillText(`Best: ${highScore}`, W / 2, 340);
  }

  // Floating bird
  const bobY = Math.sin(Date.now() / 300) * 12;
  const img = birdFrames[0];
  ctx.drawImage(img, W / 2 - img.width / 2, 420 + bobY);

  // Tap hint
  ctx.font = "bold 26px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#ddd";
  const hintText = isMobile() ? "Tap to play" : "Press Space / Click to play";
  ctx.strokeText(hintText, W / 2, 560);
  ctx.fillText(hintText, W / 2, 560);
}

function drawGameOver() {
  // Dim overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.lineWidth = 5;

  // Game Over
  ctx.font = "bold 64px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#FF5555";
  ctx.strokeStyle = "#000";
  ctx.strokeText("Game Over", W / 2, 300);
  ctx.fillText("Game Over", W / 2, 300);

  // Score
  ctx.font = "bold 48px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.strokeText(`Score: ${score}`, W / 2, 380);
  ctx.fillText(`Score: ${score}`, W / 2, 380);

  // High score
  ctx.font = "bold 32px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#FFE44D";
  ctx.strokeText(`Best: ${highScore}`, W / 2, 430);
  ctx.fillText(`Best: ${highScore}`, W / 2, 430);

  // Medal for good scores
  if (score >= 10) {
    const medal = score >= 40 ? "🏆" : score >= 20 ? "🥇" : "🥈";
    ctx.font = "64px serif";
    ctx.fillText(medal, W / 2, 510);
  }

  // Restart hint
  ctx.font = "bold 26px 'Comic Sans MS', cursive, sans-serif";
  ctx.fillStyle = "#ddd";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  const restartText = isMobile() ? "Tap to restart" : "Press Space / Click to restart";
  ctx.strokeText(restartText, W / 2, 580);
  ctx.fillText(restartText, W / 2, 580);
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

// ---------------------------------------------------------------------------
// Game reset
// ---------------------------------------------------------------------------
function resetGame() {
  score = 0;
  pipes = [];
  pipeTimer = PIPE_SPAWN_INTERVAL - 400; // first pipe comes quickly
  resetBird();
  baseX1 = 0;
  baseX2 = baseImg.width;
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------
let inputReady = true; // debounce for death → restart

function handleAction() {
  if (state === STATE.MENU) {
    state = STATE.PLAYING;
    resetGame();
    jumpBird(); // first press also jumps
  } else if (state === STATE.PLAYING) {
    jumpBird();
  } else if (state === STATE.DEAD) {
    if (!inputReady) return;
    state = STATE.MENU;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    handleAction();
  }
});

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  handleAction();
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  handleAction();
}, { passive: false });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  // Delta time: scale everything relative to 60fps (16.67ms per frame)
  if (!lastTime) lastTime = timestamp;
  const rawDt = timestamp - lastTime;
  lastTime = timestamp;
  // Clamp dt to avoid huge jumps (e.g. tab was hidden)
  const dt = Math.min(rawDt, 50) / 16.667;

  if (state === STATE.MENU) {
    updateBase(dt);
    drawStartScreen();
    return;
  }

  if (state === STATE.PLAYING) {
    updateBird(dt);
    updatePipes(dt);
    updateBase(dt);

    if (checkCollisions()) {
      // Die
      state = STATE.DEAD;
      inputReady = false;
      deadTick = 0;

      if (score > highScore) {
        highScore = score;
        localStorage.setItem("flappyHighScore", String(highScore));
      }

      // Brief delay before allowing restart
      setTimeout(() => { inputReady = true; }, 400);
    }

    // Draw
    ctx.drawImage(bgImg, 0, 0);
    drawPipes();
    drawBase();
    drawBird();
    drawScore();
    return;
  }

  if (state === STATE.DEAD) {
    // Keep drawing last frame + overlay
    ctx.drawImage(bgImg, 0, 0);
    drawPipes();
    drawBase();
    drawBird();
    drawScore();
    drawGameOver();
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  // Loading text
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Loading...", W / 2, H / 2);

  await loadAssets();
  buildScaledAssets();

  baseX2 = baseImg.width;

  lastTime = 0;
  gameLoop(0);
}

boot();
