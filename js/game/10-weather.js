/* ============================================================
   WEATHER — visual only. CLEAR leaves the existing theme atmosphere
   untouched; STORM layers darker sky/lighting, pooled rain, storm
   clouds, and occasional lightning on top of whichever theme is active.
   ============================================================ */
const WEATHER = {
  clear: null,
  storm: {
    sky: { top: 0x14171d, mid: 0x2b3038, bottom: 0x40454c },
    fogDensityMul: 1.8, hemiIntensityMul: 0.55, sunIntensityMul: 0.45,
  },
};
let currentWeatherKey = 'clear';
const baseFloorRoughness = floorMat.roughness;

// Rain — pooled sprites that wrap around the player (same technique as the existing
// ambient dust pool), reusing glowTex stretched into a soft streak. Only active/visible
// during storm; otherwise every drop stays hidden.
const RAIN_COUNT = isTouch ? 70 : 130;
const rainMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xaebdc9, transparent: true, opacity: 0.3, depthWrite: false });
const rainPool = [];
for (let i = 0; i < RAIN_COUNT; i++) {
  const spr = new THREE.Sprite(rainMat);
  spr.scale.set(0.028, 0.5, 1);
  spr.visible = false;
  scene.add(spr);
  rainPool.push(spr);
}
function resetRainDrop(spr) {
  const a = Math.random() * Math.PI * 2, r = Math.random() * 16;
  spr.position.set(player.pos.x + Math.cos(a) * r, 3 + Math.random() * 6, player.pos.z + Math.sin(a) * r);
}
function updateRain(dt) {
  if (currentWeatherKey !== 'storm') { for (const s of rainPool) s.visible = false; return; }
  for (const spr of rainPool) {
    if (!spr.visible) { resetRainDrop(spr); spr.visible = true; }
    spr.position.y -= dt * 11;
    spr.position.x -= dt * 1.4;
    const dx = spr.position.x - player.pos.x, dz = spr.position.z - player.pos.z;
    if (spr.position.y < 0.1 || Math.hypot(dx, dz) > 18) resetRainDrop(spr);
  }
}

// Storm clouds — a handful of huge, soft, dark sprites high above the arena. Cheap
// (sprites, no geometry), toggled visible only during storm.
const cloudMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x23262c, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
const stormClouds = [];
for (let i = 0; i < 7; i++) {
  const spr = new THREE.Sprite(cloudMat);
  const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
  const r = 60 + Math.random() * 50;
  spr.position.set(Math.cos(a) * r, 55 + Math.random() * 20, Math.sin(a) * r);
  spr.scale.set(90 + Math.random() * 40, 55 + Math.random() * 25, 1);
  spr.visible = false;
  scene.add(spr);
  stormClouds.push(spr);
}

// Lightning — one dedicated brief DirectionalLight, off by default. Occasional,
// unpredictable timing; a couple of quick flickers then dark again. Purely a
// lighting pulse — never touches camera/aim, so it can't interfere with gameplay.
const lightningLight = new THREE.DirectionalLight(0xdde8ff, 0);
lightningLight.position.set(-42, 60, -55);
scene.add(lightningLight);
let lightningTimer = 5 + Math.random() * 8;
function updateLightning(dt) {
  if (currentWeatherKey !== 'storm') { lightningLight.intensity = 0; return; }
  lightningTimer -= dt;
  if (lightningTimer <= 0) {
    lightningLight.intensity = 2.0 + Math.random() * 0.6;
    const doubleFlicker = Math.random() > 0.5;
    clearTimeout(updateLightning._t1); clearTimeout(updateLightning._t2);
    updateLightning._t1 = setTimeout(() => { lightningLight.intensity = doubleFlicker ? 0.7 : 0; }, 60 + Math.random() * 40);
    if (doubleFlicker) updateLightning._t2 = setTimeout(() => { lightningLight.intensity = 0; }, 160 + Math.random() * 60);
    lightningTimer = 6 + Math.random() * 11; // next strike in 6-17s — occasional, unpredictable
  }
}

function applyWeather(key) {
  currentWeatherKey = WEATHER[key] ? key : 'clear';
  const theme = THEMES[currentThemeKey];
  const w = WEATHER[currentWeatherKey];
  if (!w) {
    // CLEAR — restore the current theme's own sky/fog/lighting exactly (no override)
    skyMat.uniforms.top.value.set(theme.sky.top);
    skyMat.uniforms.mid.value.set(theme.sky.mid);
    skyMat.uniforms.bottom.value.set(theme.sky.bottom);
    scene.fog.density = theme.fog.density;
    hemi.intensity = theme.hemiIntensity;
    sun.intensity = theme.sunIntensity;
    floorMat.roughness = baseFloorRoughness;
    stormClouds.forEach(c => { c.visible = false; });
  } else {
    skyMat.uniforms.top.value.set(w.sky.top);
    skyMat.uniforms.mid.value.set(w.sky.mid);
    skyMat.uniforms.bottom.value.set(w.sky.bottom);
    scene.fog.density = theme.fog.density * w.fogDensityMul;
    hemi.intensity = theme.hemiIntensity * w.hemiIntensityMul;
    sun.intensity = theme.sunIntensity * w.sunIntensityMul;
    floorMat.roughness = Math.max(0.35, baseFloorRoughness * 0.6); // subtle wet-ground sheen
    stormClouds.forEach(c => { c.visible = true; });
  }
  floorMat.needsUpdate = true;
}
applyWeather('clear');

// Weather toggle — live-previews immediately (same convention as the theme swatches);
// the overlay is opaque so the player won't see the scene until Deploy, but the
// selection is already fully applied and will persist straight into the match.
document.querySelectorAll('.weather-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.weather-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    applyWeather(btn.dataset.weather);
  });
});

// Deployment scanning/loading sequence — purely presentational (the scene is already
// built synchronously above); reveals the Deploy button once it completes. Re-runs
// every time the briefing screen is opened from the main menu.
const loadingStages = [
  'Initializing combat simulation',
  'Loading arena',
  'Calibrating weapons',
  'Deployment ready',
];
const loadingStatusEl = document.getElementById('loading-status');
const loadingBarFillEl = document.getElementById('loading-bar-fill');
let loadingStageIdx = 0;
let loadingRunId = 0;
function advanceLoadingSequence(runId) {
  if (runId !== loadingRunId) return; // superseded by a newer run (briefing re-opened)
  loadingStatusEl.textContent = loadingStages[loadingStageIdx];
  loadingBarFillEl.style.width = (((loadingStageIdx + 1) / loadingStages.length) * 100) + '%';
  loadingStageIdx++;
  if (loadingStageIdx < loadingStages.length) {
    setTimeout(() => advanceLoadingSequence(runId), 380 + Math.random() * 160);
  } else {
    document.getElementById('start-btn').classList.remove('hidden');
  }
}
function runDeploySequence() {
  loadingStageIdx = 0;
  loadingRunId++;
  document.getElementById('start-btn').classList.add('hidden');
  document.getElementById('briefing-hostiles').textContent = String(waveEnemyCount(1));
  advanceLoadingSequence(loadingRunId);
}

/* ---------- screen navigation (main menu / briefing / armory / missions / leaderboard / settings) ---------- */
function showScreen(id) {
  ['main-menu', 'start-overlay', 'armory-overlay', 'missions-overlay', 'leaderboard-overlay', 'settings-overlay'].forEach((s) => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}
function enterDeploySequence() {
  showScreen('start-overlay');
  runDeploySequence();
}
document.getElementById('menu-play-btn').addEventListener('click', enterDeploySequence);
document.getElementById('menu-play-btn-nav').addEventListener('click', enterDeploySequence);
document.getElementById('briefing-back-btn').addEventListener('click', () => showScreen('main-menu'));

// dust particles for the home-screen + briefing scenes — generated once, pure CSS animation from there
['menu-dust', 'briefing-dust', 'armory-dust', 'missions-dust', 'leaderboard-dust', 'settings-dust', 'death-dust', 'pause-dust'].forEach((id) => {
  const dustEl = document.getElementById(id);
  if (!dustEl) return;
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = (40 + Math.random() * 55) + '%';
    s.style.animationDuration = (6 + Math.random() * 8) + 's';
    s.style.animationDelay = (Math.random() * 8) + 's';
    dustEl.appendChild(s);
  }
});
// rotating combat-feed ticker
const COMBAT_FEED_MESSAGES = [
  'Hostiles reported in Dusk Canyon.',
  'Supply drop inbound to Sector 7.',
  'Weather systems tracking storm activity.',
  'Elite hostile signatures detected in prior ops.',
  'Operator readiness: standing by.',
];
let combatFeedIdx = 0;
setInterval(() => {
  combatFeedIdx = (combatFeedIdx + 1) % COMBAT_FEED_MESSAGES.length;
  const el = document.getElementById('combat-feed-line');
  if (el && !document.getElementById('main-menu').classList.contains('hidden')) {
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    el.textContent = COMBAT_FEED_MESSAGES[combatFeedIdx];
  }
}, 4500);
// refresh tactical-status personal-best readout whenever the main menu becomes visible
function refreshMenuTacticalStatus() {
  document.getElementById('ts-best-wave').textContent = save.personalBests.wave;
  document.getElementById('ts-best-score').textContent = save.personalBests.score.toLocaleString();
}
refreshMenuTacticalStatus();
document.getElementById('menu-armory-btn').addEventListener('click', () => { renderArmory(); showScreen('armory-overlay'); });
document.getElementById('armory-back-btn').addEventListener('click', () => showScreen('main-menu'));
document.getElementById('menu-missions-btn').addEventListener('click', () => { renderMissions(); showScreen('missions-overlay'); });
document.getElementById('missions-back-btn').addEventListener('click', () => showScreen('main-menu'));
document.getElementById('menu-leaderboard-btn').addEventListener('click', () => { renderLeaderboard(); showScreen('leaderboard-overlay'); });
document.getElementById('leaderboard-back-btn').addEventListener('click', () => showScreen('main-menu'));
document.getElementById('menu-settings-btn').addEventListener('click', () => { renderSettings(); showScreen('settings-overlay'); });
document.getElementById('settings-back-btn').addEventListener('click', () => showScreen('main-menu'));

/* ---------- armory ---------- */
const WEAPON_ORDER = ['assault', 'smg', 'shotgun', 'sniper', 'lmg'];
function renderArmory() {
  const container = document.getElementById('armory-cards');
  container.innerHTML = '';
  WEAPON_ORDER.forEach((key) => {
    const def = WEAPON_DEFS[key];
    const unlockLvl = WEAPON_UNLOCK_LEVEL[key];
    const unlocked = save.level >= unlockLvl;
    const card = document.createElement('div');
    card.className = 'armory-card' + (unlocked ? '' : ' locked');
    card.innerHTML = `
      <h3>${def.name}</h3>
      <div class="stat-row"><span>Damage</span><b>${def.damage}</b></div>
      <div class="stat-row"><span>Fire Rate</span><b>${(1 / def.fireInterval).toFixed(1)}/s</b></div>
      <div class="stat-row"><span>Magazine</span><b>${def.magSize}</b></div>
      <div class="stat-row"><span>Range</span><b>${def.range}m</b></div>
      <div class="status ${unlocked ? 'equipped' : 'locked-tag'}">${unlocked ? (key === currentWeaponKey ? 'Equipped' : 'Unlocked') : 'Unlock at Level ' + unlockLvl}</div>
    `;
    container.appendChild(card);
  });
}

/* ---------- daily missions ---------- */
function checkDailyMissions() {
  DAILY_MISSIONS.forEach((m) => {
    if (!save.daily.claimed[m.key] && (save.daily[m.key] || 0) >= m.target) {
      save.daily.claimed[m.key] = true;
      grantXP(m.reward);
      persistSave();
    }
  });
}
function renderMissions() {
  const container = document.getElementById('missions-list');
  container.innerHTML = '';
  DAILY_MISSIONS.forEach((m) => {
    const progress = Math.min(m.target, save.daily[m.key] || 0);
    const complete = progress >= m.target;
    const row = document.createElement('div');
    row.className = 'mission-row' + (complete ? ' complete' : '');
    row.innerHTML = `
      <div class="m-label"><span>${m.label}</span><span>${progress} / ${m.target}</span></div>
      <div class="m-progress-bar"><div class="m-progress-fill" style="width:${(progress / m.target * 100)}%"></div></div>
      <div class="m-reward">${complete ? 'Complete — ' : ''}+${m.reward} XP</div>
    `;
    container.appendChild(row);
  });
}

/* ---------- personal bests ---------- */
function renderLeaderboard() {
  const pb = save.personalBests;
  document.getElementById('leaderboard-list').innerHTML = `
    <div class="stat-line"><span>Best Score</span><b>${pb.score.toLocaleString()}</b></div>
    <div class="stat-line"><span>Best Wave</span><b>${pb.wave}</b></div>
    <div class="stat-line"><span>Best Kill Streak</span><b>${pb.streak}</b></div>
    <div class="stat-line"><span>Most Kills</span><b>${pb.kills}</b></div>
    <div class="stat-line"><span>Best Accuracy</span><b>${pb.accuracy}%</b></div>
  `;
}

/* ---------- weapon skins (cosmetic only — a color tint on the shared weapon material) ---------- */
const WEAPON_SKINS = {
  default: { label: 'Default', color: 0x272522 },
  desert: { label: 'Desert', color: 0xc9a46a },
  arctic: { label: 'Arctic', color: 0xd8e2e8 },
  carbon: { label: 'Carbon', color: 0x1a1a1c },
  neon: { label: 'Neon', color: 0x1fd1c9 },
  gold: { label: 'Gold', color: 0xd4af37 },
};
function applySkin(key) {
  save.selectedSkin = WEAPON_SKINS[key] ? key : 'default';
  gunMat.color.set(WEAPON_SKINS[save.selectedSkin].color);
  persistSave();
}
function renderSettings() {
  const container = document.getElementById('skin-swatches');
  container.innerHTML = '';
  Object.keys(WEAPON_SKINS).forEach((key) => {
    const sw = document.createElement('div');
    sw.className = 'skin-swatch' + (key === save.selectedSkin ? ' selected' : '');
    sw.style.background = '#' + WEAPON_SKINS[key].color.toString(16).padStart(6, '0');
    sw.title = WEAPON_SKINS[key].label;
    sw.addEventListener('click', () => { applySkin(key); renderSettings(); });
    container.appendChild(sw);
  });
  const sSlider = document.getElementById('settings-sens-slider');
  const fSlider = document.getElementById('settings-fov-slider');
  if (sSlider) { sSlider.value = String(save.sensitivity); if (typeof updateSensSettingLabel === 'function') updateSensSettingLabel(); }
  if (fSlider) { fSlider.value = String(save.fov); if (typeof updateFovSettingLabel === 'function') updateFovSettingLabel(); }
}
document.getElementById('settings-mute-btn').addEventListener('click', () => { document.getElementById('mute-btn').click(); });
const settingsMusicBtn = document.getElementById('settings-music-btn');
function updateMusicSettingLabel() {
  if (settingsMusicBtn) settingsMusicBtn.textContent = menuMusicEnabled ? 'Music: ON' : 'Music: OFF';
}
if (settingsMusicBtn) {
  updateMusicSettingLabel();
  settingsMusicBtn.addEventListener('click', () => {
    menuMusicEnabled = !menuMusicEnabled;
    try { localStorage.setItem('bulletfall_menu_music', menuMusicEnabled ? 'on' : 'off'); } catch (e) {}
    if (menuMusicEnabled) {
      const menu = document.getElementById('main-menu');
      if (menu && !menu.classList.contains('hidden') && !audioMuted) {
        initAudio();
        resumeAudio();
        startMenuMusic();
      }
    } else {
      stopMenuMusic();
    }
    updateMusicSettingLabel();
  });
}

/* ---------- sensitivity / FOV sliders ---------- */
const sensSlider = document.getElementById('settings-sens-slider');
const sensVal = document.getElementById('settings-sens-val');
const fovSlider = document.getElementById('settings-fov-slider');
const fovVal = document.getElementById('settings-fov-val');
function updateSensSettingLabel() { if (sensVal) sensVal.textContent = save.sensitivity.toFixed(2) + '×'; }
function updateFovSettingLabel() { if (fovVal) fovVal.textContent = Math.round(save.fov) + '°'; }
if (sensSlider) {
  sensSlider.value = String(save.sensitivity);
  updateSensSettingLabel();
  sensSlider.addEventListener('input', () => {
    save.sensitivity = parseFloat(sensSlider.value);
    updateSensSettingLabel();
    persistSave();
  });
}
if (fovSlider) {
  fovSlider.value = String(save.fov);
  updateFovSettingLabel();
  fovSlider.addEventListener('input', () => {
    save.fov = parseFloat(fovSlider.value);
    baseFov = save.fov;
    updateFovSettingLabel();
    persistSave();
  });
}

applySkin(save.selectedSkin);
updateXPHud();



// Extra muzzle glow sprite — softens/rounds out the existing cone flash, additive blend.
const muzzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffcf8a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
}));
muzzleGlow.scale.set(0.001, 0.001, 1);
muzzleGlow.position.set(0.16, -0.14, -0.56);
camera.add(muzzleGlow);

// Shell casing pool — small reused meshes ejected from the gun, no per-shot allocation.
const CASING_POOL_SIZE = 6;
const casingGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.022, 5);
const casingMat = new THREE.MeshStandardMaterial({ color: 0xd8b458, roughness: 0.4, metalness: 0.6 });
const casingPool = [];
for (let i = 0; i < CASING_POOL_SIZE; i++) {
  // each casing gets its own cloned material so per-weapon tinting never bleeds across pooled instances
  const m = new THREE.Mesh(casingGeo, casingMat.clone());
  m.visible = false;
  camera.add(m);
  casingPool.push({ mesh: m, vel: new THREE.Vector3(), angVel: new THREE.Vector3(), life: 0, maxLife: 0 });
}
let casingCursor = 0;
function ejectCasing() {
  const c = casingPool[casingCursor]; casingCursor = (casingCursor + 1) % CASING_POOL_SIZE;
  c.mesh.position.copy(weapon.casingOffset);
  c.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  c.mesh.scale.setScalar(weapon.casingScale);
  c.mesh.material.color.set(weapon.casingColor);
  c.vel.set(0.9 + Math.random() * 0.4, 1.0 + Math.random() * 0.5, -0.3 + Math.random() * 0.6);
  c.angVel.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
  c.life = 0; c.maxLife = 0.55 + Math.random() * 0.2;
  c.mesh.visible = true;
}
function updateCasings(dt) {
  for (const c of casingPool) {
    if (!c.mesh.visible) continue;
    c.life += dt;
    if (c.life >= c.maxLife) { c.mesh.visible = false; continue; }
    c.vel.y -= 3.2 * dt;
    c.mesh.position.addScaledVector(c.vel, dt);
    c.mesh.rotation.x += c.angVel.x * dt;
    c.mesh.rotation.y += c.angVel.y * dt;
    c.mesh.rotation.z += c.angVel.z * dt;
  }
}

// Bullet impact particle pool — pooled sprites (world-space), reused round-robin.
const IMPACT_POOL_SIZE = 18;
const impactPool = [];
for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(0.001, 0.001, 1);
  spr.visible = false;
  scene.add(spr);
  impactPool.push({ mesh: spr, vel: new THREE.Vector3(), life: 0, maxLife: 0 });
}
let impactCursor = 0;
function spawnImpact(point, isBot, surface, strong) {
  const count = isBot ? (strong ? 7 : 4) : 3;
  let color = 0xffd9a0;
  if (isBot) color = strong ? 0xffe8a0 : 0xff5a3a;
  else if (surface === 'wood') color = 0xc9a15a;
  else if (surface === 'metal') color = 0xdfe6ea;
  const speedMul = strong ? 1.6 : 1;
  const sizeMul = strong ? 1.5 : 1;
  for (let i = 0; i < count; i++) {
    const p = impactPool[impactCursor]; impactCursor = (impactCursor + 1) % IMPACT_POOL_SIZE;
    p.mesh.position.copy(point);
    p.mesh.material.color.set(color);
    p.mesh.material.opacity = 1;
    p.mesh.visible = true;
    const s = (0.06 + Math.random() * 0.05) * sizeMul;
    p.mesh.scale.set(s, s, 1);
    p.vel.set((Math.random() - 0.5) * 1.4 * speedMul, (Math.random() * 1.2 + 0.4) * speedMul, (Math.random() - 0.5) * 1.4 * speedMul);
    p.life = 0; p.maxLife = 0.18 + Math.random() * 0.1;
  }
  if (!isBot) spawnDustKick(point);
}

// Dust kick-up on environment impacts — bigger, softer, slower than the sharp sparks
// above; a small separate pool (same convention as the tracer/smoke/casing pools).
const DUSTKICK_POOL_SIZE = 10;
const dustKickPool = [];
for (let i = 0; i < DUSTKICK_POOL_SIZE; i++) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, color: 0xcabb98, transparent: true, opacity: 0, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.visible = false;
  scene.add(spr);
  dustKickPool.push({ mesh: spr, vel: new THREE.Vector3(), life: 0, maxLife: 0 });
}
let dustKickCursor = 0;
function spawnDustKick(point) {
  const d = dustKickPool[dustKickCursor]; dustKickCursor = (dustKickCursor + 1) % DUSTKICK_POOL_SIZE;
  d.mesh.position.copy(point);
  d.mesh.material.opacity = 0.4;
  d.mesh.visible = true;
  d.mesh.scale.set(0.1, 0.1, 1);
  d.vel.set((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
  d.life = 0; d.maxLife = 0.45 + Math.random() * 0.2;
}
function updateDustKick(dt) {
  for (const d of dustKickPool) {
    if (!d.mesh.visible) continue;
    d.life += dt;
    if (d.life >= d.maxLife) { d.mesh.visible = false; continue; }
    const t = d.life / d.maxLife;
    d.vel.y -= 0.6 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.material.opacity = 0.4 * (1 - t);
    const s = 0.1 + t * 0.35;
    d.mesh.scale.set(s, s, 1);
  }
}
function updateImpacts(dt) {
  for (const p of impactPool) {
    if (!p.mesh.visible) continue;
    p.life += dt;
    if (p.life >= p.maxLife) { p.mesh.visible = false; continue; }
    const t = p.life / p.maxLife;
    p.vel.y -= 4 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = 1 - t;
    const s = 0.06 + (1 - t) * 0.02;
    p.mesh.scale.set(s, s, 1);
  }
}

