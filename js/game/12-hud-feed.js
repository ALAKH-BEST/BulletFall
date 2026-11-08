/* ============================================================
   FLOATING DAMAGE NUMBERS
   A small pool of plain DOM nodes (cheaper than sprites for text, and
   crisp at any zoom) positioned by projecting a 3D world point through
   the camera every frame — the point itself drifts slowly upward in
   world space over its short life, which is what gives the "number
   rises off the hit" look rather than it floating off-target as the
   player turns or moves mid-animation.
   ============================================================ */
const DMG_NUM_POOL_SIZE = 16;
const dmgNumLayer = document.getElementById('dmg-num-layer');
const dmgNumPool = [];
if (dmgNumLayer) {
  for (let i = 0; i < DMG_NUM_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'dmg-num';
    el.style.display = 'none';
    dmgNumLayer.appendChild(el);
    dmgNumPool.push({ el, worldPos: new THREE.Vector3(), life: 0, maxLife: 0, jitterX: 0, active: false });
  }
}
let dmgNumCursor = 0;
const _dmgNumProj = new THREE.Vector3();
function spawnDamageNumber(point, amount, isHeadshot, isKill) {
  if (!dmgNumLayer || dmgNumPool.length === 0) return;
  const d = dmgNumPool[dmgNumCursor]; dmgNumCursor = (dmgNumCursor + 1) % DMG_NUM_POOL_SIZE;
  d.worldPos.copy(point);
  d.life = 0; d.maxLife = 0.7;
  d.jitterX = (Math.random() - 0.5) * 24;
  d.active = true;
  d.el.textContent = Math.max(1, Math.round(amount));
  d.el.className = 'dmg-num' + (isKill ? ' kill' : (isHeadshot ? ' headshot' : ''));
  d.el.style.display = 'block';
  d.el.style.opacity = '1';
}
function updateDamageNumbers(dt) {
  if (dmgNumPool.length === 0) return;
  for (const d of dmgNumPool) {
    if (!d.active) continue;
    d.life += dt;
    if (d.life >= d.maxLife) { d.active = false; d.el.style.display = 'none'; continue; }
    d.worldPos.y += dt * 0.75;
    _dmgNumProj.copy(d.worldPos).project(camera);
    if (_dmgNumProj.z > 1) { d.el.style.display = 'none'; continue; } // behind the camera
    const sx = (_dmgNumProj.x * 0.5 + 0.5) * window.innerWidth + d.jitterX;
    const sy = (1 - (_dmgNumProj.y * 0.5 + 0.5)) * window.innerHeight;
    d.el.style.display = 'block';
    d.el.style.left = sx + 'px';
    d.el.style.top = sy + 'px';
    const t = d.life / d.maxLife;
    d.el.style.opacity = t < 0.75 ? '1' : String(1 - (t - 0.75) / 0.25);
  }
}

/* ============================================================
   KILL FEED
   Stacked toast entries. Driven by plain per-frame inline-style updates
   (updateKillFeed below, called from the main loop) rather than a CSS
   @keyframes animation — the CSS-animation version of this visibly never
   painted under this project's headless/software-rendered test setup
   (confirmed: getComputedStyle reported the correct end-state opacity/
   transform throughout, but nothing actually rendered, while forcing the
   same values via inline style painted instantly), the same class of
   headless-vs-real-browser gap that bit the shotgun/LMG model work
   earlier. Matching the already-proven-reliable approach used for the
   floating damage numbers below sidesteps that risk entirely.
   ============================================================ */
const KILL_FEED_MAX = 5;
const KILL_FEED_LIFE = 4.0; // seconds an entry stays up, fade included
const KILL_FEED_FADE_IN = 0.25;
const KILL_FEED_FADE_OUT = 0.4;
const killFeedEntries = [];
function addKillFeedEntry(bot, isHeadshot) {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const label = (bot.type || 'normal').toUpperCase();
  const entry = document.createElement('div');
  entry.className = 'kf-entry' + (isHeadshot ? ' headshot' : '') + (bot.type === 'elite' ? ' elite' : '');
  entry.innerHTML = '<span class="kf-you">YOU</span> ↠ ' + label + (isHeadshot ? ' <span class="kf-tag">HEADSHOT</span>' : '');
  entry.style.opacity = '0';
  entry.style.transform = 'translateX(12px)';
  feed.appendChild(entry);
  killFeedEntries.push({ el: entry, life: 0 });
  while (killFeedEntries.length > KILL_FEED_MAX) {
    const old = killFeedEntries.shift();
    if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
  }
}
function updateKillFeed(dt) {
  for (let i = killFeedEntries.length - 1; i >= 0; i--) {
    const e = killFeedEntries[i];
    e.life += dt;
    if (e.life >= KILL_FEED_LIFE) {
      if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
      killFeedEntries.splice(i, 1);
      continue;
    }
    let opacity, slide;
    if (e.life < KILL_FEED_FADE_IN) {
      const t = e.life / KILL_FEED_FADE_IN;
      opacity = t; slide = 12 * (1 - t);
    } else if (e.life > KILL_FEED_LIFE - KILL_FEED_FADE_OUT) {
      const t = (KILL_FEED_LIFE - e.life) / KILL_FEED_FADE_OUT;
      opacity = t; slide = 12 * (1 - t);
    } else {
      opacity = 1; slide = 0;
    }
    e.el.style.opacity = String(opacity);
    e.el.style.transform = 'translateX(' + slide + 'px)';
  }
}

/* ============================================================
   MINIMAP
   Plain top-down radar: player centered and facing up, bots drawn as
   dots relative to the player within a fixed world-space radius. Canvas
   redrawn every frame rather than pooling DOM dots — a handful of
   circle fills is cheap, and a full redraw sidesteps any stale-dot
   bookkeeping as bots die/respawn.
   ============================================================ */
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const MINIMAP_RANGE = 30; // world units shown from center to edge
function updateMinimap() {
  if (!minimapCtx) return;
  const w = minimapCanvas.width, h = minimapCanvas.height;
  const cx = w / 2, cy = h / 2;
  const scale = (w / 2) / MINIMAP_RANGE;
  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.save();
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, w / 2, 0, Math.PI * 2);
  minimapCtx.clip();
  minimapCtx.fillStyle = 'rgba(20,14,6,0.35)';
  minimapCtx.fillRect(0, 0, w, h);

  // Bots: rotate each relative position by -player yaw so the map stays
  // player-facing-up, matching the player arrow drawn fixed at top.
  const yaw = yawObject.rotation.y;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  bots.forEach((b) => {
    if (!b.alive) return;
    const dx = b.group.position.x - player.pos.x;
    const dz = b.group.position.z - player.pos.z;
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > MINIMAP_RANGE) return;
    const px = cx + rx * scale;
    const py = cy + rz * scale;
    minimapCtx.beginPath();
    minimapCtx.fillStyle = b.type === 'elite' ? '#ff6b35' : '#e2543a';
    minimapCtx.arc(px, py, b.type === 'elite' ? 4.5 : 3.2, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Pickups, so the player can see a crate/medkit worth detouring for.
  pickupPool.forEach((p) => {
    if (!p.active) return;
    const dx = p.group.position.x - player.pos.x;
    const dz = p.group.position.z - player.pos.z;
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > MINIMAP_RANGE) return;
    const px = cx + rx * scale;
    const py = cy + rz * scale;
    minimapCtx.beginPath();
    minimapCtx.fillStyle = p.type === 'ammo' ? '#ffd9a0' : '#8fd6c9';
    minimapCtx.arc(px, py, 2.4, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  minimapCtx.restore();

  // Player arrow — fixed at center, pointing up, since the map rotates around them.
  minimapCtx.save();
  minimapCtx.translate(cx, cy);
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -7);
  minimapCtx.lineTo(5, 6);
  minimapCtx.lineTo(0, 3);
  minimapCtx.lineTo(-5, 6);
  minimapCtx.closePath();
  minimapCtx.fillStyle = '#f1e9dd';
  minimapCtx.fill();
  minimapCtx.restore();
}

// Bullet tracers — thin pooled cylinders stretched between origin and hit point, fade fast.
const TRACER_POOL_SIZE = 10;
const tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 4);
const tracerPool = [];
for (let i = 0; i < TRACER_POOL_SIZE; i++) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const m = new THREE.Mesh(tracerGeo, mat);
  m.visible = false;
  scene.add(m);
  tracerPool.push({ mesh: m, life: 0, maxLife: 0 });
}
let tracerCursor = 0;
const _tracerMid = new THREE.Vector3(), _tracerDir = new THREE.Vector3(), _tracerUp = new THREE.Vector3(0, 1, 0);
function spawnTracer(from, to, thin) {
  const t = tracerPool[tracerCursor]; tracerCursor = (tracerCursor + 1) % TRACER_POOL_SIZE;
  const len = from.distanceTo(to);
  if (len < 0.05) return;
  _tracerMid.copy(from).add(to).multiplyScalar(0.5);
  t.mesh.position.copy(_tracerMid);
  _tracerDir.copy(to).sub(from).normalize();
  t.mesh.quaternion.setFromUnitVectors(_tracerUp, _tracerDir);
  t.mesh.scale.set(thin ? 0.008 : 0.012, len, thin ? 0.008 : 0.012);
  t.mesh.material.opacity = 0.85;
  t.mesh.visible = true;
  t.life = 0; t.maxLife = 0.05;
}
function updateTracers(dt) {
  for (const t of tracerPool) {
    if (!t.mesh.visible) continue;
    t.life += dt;
    if (t.life >= t.maxLife) { t.mesh.visible = false; continue; }
    t.mesh.material.opacity = 0.85 * (1 - t.life / t.maxLife);
  }
}

// Muzzle smoke — a few pooled soft puffs that drift up and fade after each shot.
const SMOKE_POOL_SIZE = 8;
const smokePool = [];
for (let i = 0; i < SMOKE_POOL_SIZE; i++) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0xcfc9c0, transparent: true, opacity: 0, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.visible = false;
  camera.add(spr);
  smokePool.push({ mesh: spr, vel: new THREE.Vector3(), life: 0, maxLife: 0 });
}
let smokeCursor = 0;
function spawnMuzzleSmoke() {
  const s = smokePool[smokeCursor]; smokeCursor = (smokeCursor + 1) % SMOKE_POOL_SIZE;
  s.mesh.position.copy(weapon.muzzleOffset);
  s.mesh.scale.set(0.05, 0.05, 1);
  s.mesh.material.opacity = 0.35;
  s.mesh.visible = true;
  s.vel.set((Math.random() - 0.5) * 0.06, 0.12 + Math.random() * 0.05, -0.05 - Math.random() * 0.05);
  s.life = 0; s.maxLife = 0.4 + Math.random() * 0.15;
}
function updateSmoke(dt) {
  for (const s of smokePool) {
    if (!s.mesh.visible) continue;
    s.life += dt;
    if (s.life >= s.maxLife) { s.mesh.visible = false; continue; }
    const t = s.life / s.maxLife;
    s.mesh.position.addScaledVector(s.vel, dt);
    s.mesh.material.opacity = 0.35 * (1 - t);
    const sc = 0.05 + t * 0.1;
    s.mesh.scale.set(sc, sc, 1);
  }
}

// Ambient floating dust — a small fixed pool that wraps around the player within a
// radius, so it reads as atmospheric haze everywhere without ever needing to be large.
const DUST_COUNT = isTouch ? 16 : 28;
const dustMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xd8c9a8, transparent: true, opacity: 0.13, depthWrite: false });
const dustPool = [];
for (let i = 0; i < DUST_COUNT; i++) {
  const spr = new THREE.Sprite(dustMat);
  const s = 0.05 + Math.random() * 0.08;
  spr.scale.set(s, s, 1);
  const a = Math.random() * Math.PI * 2, r = Math.random() * 14;
  spr.position.set(Math.cos(a) * r, 0.3 + Math.random() * 3.5, Math.sin(a) * r);
  spr.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.04 + Math.random() * 0.05, (Math.random() - 0.5) * 0.15);
  scene.add(spr);
  dustPool.push(spr);
}
function updateDust(dt) {
  for (const spr of dustPool) {
    spr.position.addScaledVector(spr.userData.vel, dt);
    const dx = spr.position.x - player.pos.x, dz = spr.position.z - player.pos.z;
    if (Math.hypot(dx, dz) > 16 || spr.position.y > 4.2) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 4;
      spr.position.set(player.pos.x + Math.cos(a) * r, 0.3 + Math.random() * 2.5, player.pos.z + Math.sin(a) * r);
    }
  }
}

// Slow rising smoke wisps at two "damaged area" landmarks (the vehicle wreck + tower
// top) — a tiny pooled system, each wisp loops through a short rise-and-fade cycle.
const AMBIENT_SMOKE_SOURCES = [{ x: -22, z: -25, y: 1.0 }, { x: -24, z: -22, y: 9.4 }];
const ambientSmokePool = [];
AMBIENT_SMOKE_SOURCES.forEach((src) => {
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0x8a8378, transparent: true, opacity: 0, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    scene.add(spr);
    ambientSmokePool.push({ mesh: spr, src, life: Math.random() * 3, maxLife: 3.5 });
  }
});
function resetAmbientSmoke(p) {
  p.mesh.position.set(p.src.x + (Math.random() - 0.5) * 0.6, p.src.y, p.src.z + (Math.random() - 0.5) * 0.6);
  p.life = 0; p.maxLife = 3 + Math.random() * 1.5;
  p.mesh.scale.set(0.3, 0.3, 1);
}
ambientSmokePool.forEach(resetAmbientSmoke);
function updateAmbientSmoke(dt) {
  for (const p of ambientSmokePool) {
    p.life += dt;
    if (p.life >= p.maxLife) { resetAmbientSmoke(p); continue; }
    const t = p.life / p.maxLife;
    p.mesh.position.y += dt * 0.35;
    p.mesh.position.x += Math.sin(p.life * 1.3) * 0.003;
    p.mesh.material.opacity = Math.sin(t * Math.PI) * 0.22;
    const s = 0.3 + t * 1.1;
    p.mesh.scale.set(s, s, 1);
  }
}

// Weapon-feel state — look/strafe sway and recoil jitter, purely cosmetic (does not affect aim/shooting logic).
const gunFeel = {
  swayYaw: 0, swayPitch: 0, strafeTilt: 0, recoilKickZ: 0, sprintLower: 0, fovPunch: 0, landCompress: 0,
  // idle breathing + weapon-check inspect — purely cosmetic, never touches the camera/raycast.
  breatheT: 0, idleTime: 0,
  inspectActive: false, inspectBlend: 0, inspectT: 0, inspectDuration: 2.1,
  nextInspectDelay: 8 + Math.random() * 6,
};
let adsBlend = 0;
let screenShake = 0; // CSS-transform screen shake on the canvas element — visual only,
                      // never touches the Three.js camera/pitchObject used for raycasting
const reddotEl = document.getElementById('ads-reddot');
const shotgunSightEl = document.getElementById('ads-shotgun-sight');
const scopeEl = document.getElementById('ads-scope');
const crosshairEl = document.getElementById('crosshair');

const player = {
  pos: new THREE.Vector3(0, 0, 6),
  velY: 0,
  grounded: true,
  health: 100,
  maxHealth: 100,
  alive: true,
  bobT: 0,
  recoil: 0,
  sprinting: false,
  footstepSign: 1,
};

function damagePlayer(amount) {
  if (!player.alive) return;
  player.health = Math.max(0, player.health - amount);
  updateHealthHUD();
  flashDamageVignette();
  sfxPlayerHurt();
  if (player.health <= 0) onPlayerDeath();
}

function flashDamageVignette() {
  const v = document.getElementById('dmg-vignette');
  v.classList.add('hit');
  clearTimeout(flashDamageVignette._t);
  flashDamageVignette._t = setTimeout(() => v.classList.remove('hit'), 220);
}

