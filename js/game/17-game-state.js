/* ============================================================
   GAME STATE / LIFECYCLE
   ============================================================ */
Input.gameActive = false;

function onPlayerDeath() {
  player.alive = false;
  Input.gameActive = false;
  stopCombatMusic();
  if (document.pointerLockElement) document.exitPointerLock();
  const elapsed = (performance.now() - stats.startTime) / 1000;
  const mm = Math.floor(elapsed / 60), ss = Math.floor(elapsed % 60);
  const accuracy = stats.shots > 0 ? Math.round(stats.hits / stats.shots * 100) : 0;

  document.getElementById('stat-score').textContent = matchStats.score.toLocaleString();
  document.getElementById('stat-wave').textContent = String(WaveManager.wave).padStart(2, '0');
  document.getElementById('stat-kills').textContent = matchStats.kills;
  document.getElementById('stat-headshots').textContent = matchStats.headshots;
  document.getElementById('stat-acc').textContent = accuracy + '%';
  document.getElementById('stat-time').textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
  document.getElementById('stat-streak').textContent = matchStats.bestStreak;
  document.getElementById('stat-xp').textContent = '+' + matchStats.xpEarned;

  const pb = save.personalBests;
  pb.score = Math.max(pb.score, matchStats.score);
  pb.wave = Math.max(pb.wave, WaveManager.wave);
  pb.streak = Math.max(pb.streak, matchStats.bestStreak);
  pb.kills = Math.max(pb.kills, matchStats.kills);
  pb.accuracy = Math.max(pb.accuracy, accuracy);
  persistSave();

  document.getElementById('death-overlay').classList.remove('hidden');
  const statEls = document.querySelectorAll('#death-stats > div');
  statEls.forEach((el) => el.classList.remove('show'));
  statEls.forEach((el, i) => setTimeout(() => el.classList.add('show'), 120 + i * 90));
}

function openPauseMenu() {
  if (!Input.gameActive || Input.paused) return;
  Input.paused = true;
  Input.gameActive = false;
  Input.shootHeld = false; Input.adsHeld = false;
  document.getElementById('pause-controls').classList.add('hidden');
  document.getElementById('pause-main').classList.remove('hidden');
  document.getElementById('pause-overlay').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() {
  if (!Input.paused) return;
  Input.paused = false;
  Input.gameActive = true;
  document.getElementById('pause-overlay').classList.add('hidden');
  if (!isTouch) canvasEl.requestPointerLock();
}
function goToMainMenu() {
  Input.paused = false;
  Input.gameActive = false;
  stopCombatMusic();
  document.getElementById('pause-overlay').classList.add('hidden');
  showScreen('main-menu');
  updateXPHud();
  refreshMenuTacticalStatus();
  // The one-time autoplay unlock only runs on the first interaction, so
  // explicitly restart the menu score whenever the player returns here.
  initAudio();
  resumeAudio();
  startMenuMusic();
}
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('pause-controls-btn').addEventListener('click', () => {
  document.getElementById('pause-main').classList.add('hidden');
  document.getElementById('pause-controls').classList.remove('hidden');
});
document.getElementById('pause-controls-back-btn').addEventListener('click', () => {
  document.getElementById('pause-controls').classList.add('hidden');
  document.getElementById('pause-main').classList.remove('hidden');
});
document.getElementById('pause-menu-btn').addEventListener('click', goToMainMenu);

function startGame() {
  stopMenuMusic();
  initAudio();
  // Resume immediately on the Start button gesture; this prevents delayed SFX
  // when the browser has suspended Web Audio while the menu was open.
  resumeAudio();
  setCombatIntensity('low');
  startCombatMusic();
  player.health = player.maxHealth; player.alive = true;
  // Classic spawns on the open arena's edge; the Abandoned Street map spawns
  // the player inside the model's own interior courtyard (a real clear gap
  // between its buildings, found from the generated collider field — see
  // STREET_SPAWN) rather than on open ground outside looking in.
  if (activeMapKey === 'street') {
    player.pos.set(STREET_SPAWN.x, 0, STREET_SPAWN.z);
  } else {
    player.pos.set(0, 0, 6);
  }
  player.velY = 0;
  stats.shots = 0; stats.hits = 0; stats.kills = 0; stats.startTime = performance.now();
  Object.keys(weaponsState).forEach((k) => {
    const def = WEAPON_DEFS[k], st = weaponsState[k];
    st.mag = def.magSize; st.reserve = def.reserveMax; st.reloading = false; st.cooldown = 0; st.reloadT = 0;
  });
  document.getElementById('reload-hint').classList.remove('show');
  currentWeaponKey = 'assault';
  weapon = weaponsState.assault;
  lmgDeployed = false;
  pickupPool.forEach((p) => { p.active = false; p.group.visible = false; });
  dmgNumPool.forEach((d) => { d.active = false; d.el.style.display = 'none'; });
  const killFeedEl = document.getElementById('kill-feed');
  if (killFeedEl) killFeedEl.innerHTML = '';
  killFeedEntries.length = 0;
  Object.keys(weaponModels).forEach((k) => { weaponModels[k].visible = (k === currentWeaponKey); });
  updatePrimitiveArmsVisibility();
  muzzleFlash.position.copy(weapon.muzzleOffset);
  flashMesh.position.copy(weapon.muzzleOffset);
  muzzleGlow.position.copy(weapon.muzzleOffset);
  matchStats.score = 0; matchStats.streak = 0; matchStats.bestStreak = 0; matchStats.lastKillTime = -99;
  matchStats.headshots = 0; matchStats.kills = 0; matchStats.xpEarned = 0;
  document.getElementById('streak-indicator').classList.add('hidden');
  updateScoreHud();
  startWave(1);
  updateHealthHUD(); updateAmmoHUD(); updateKillHUD();
  document.getElementById('start-overlay').classList.add('hidden');
  document.getElementById('death-overlay').classList.add('hidden');
  document.getElementById('pause-overlay').classList.add('hidden');
  Input.paused = false;
  Input.gameActive = true;
  if (!isTouch) canvasEl.requestPointerLock();
}

// Deployment loading screen — shown between confirming a map choice and
// actual gameplay, gating startGame() on the real assets that map actually
// needs having genuinely finished (not just hoping they're already done by
// the time the player clicks through the menu). The flavor status line
// ticks through a fixed list on a timer so it always feels alive; the bar
// fill itself is real, driven by AssetLoadTracker's byte-level progress.
const DEPLOY_STATUS_LINES_CORE = [
  'Streaming rifle rig...',
  'Placing boulders...',
  'Raising cargo containers...',
  'Calibrating optics...',
];
const DEPLOY_STATUS_LINES_STREET = [
  'Streaming rifle rig...',
  'Raising the street block...',
  'Grounding the pavement...',
  'Mapping building collision...',
];
const DEPLOY_TIPS = [
  "TIP: Reload before your magazine runs dry — there's no mid-reload cancel.",
  'TIP: Headshots deal bonus damage — aim high when you can.',
  'TIP: The LMG trades mobility for a tighter spread while deployed.',
  'TIP: Ammo crates only refill your currently equipped weapon.',
  "TIP: The combat knife swings fast but only reaches short range.",
  'TIP: Sprinting locks out firing and ADS — plant your feet to shoot straight.',
];
function beginDeployment() {
  const loadingEl = document.getElementById('loading-screen');
  if (!loadingEl) { startGame(); return; } // defensive: markup missing, don't block play
  const barFillEl = document.getElementById('loading-screen-bar-fill');
  const pctEl = document.getElementById('loading-screen-pct');
  const statusEl = document.getElementById('loading-screen-status');
  const tipEl = document.getElementById('loading-screen-tip');
  loadingEl.classList.remove('hidden');

  const useStreet = activeMapKey === 'street';
  const relevantUrls = ['assets/ak47.glb', 'assets/boulder_real.glb', 'assets/boulder_real2.glb', 'assets/shipping_container.glb']
    .concat(useStreet ? ['assets/abandoned_city_street.glb'] : []);
  const statusLines = useStreet ? DEPLOY_STATUS_LINES_STREET : DEPLOY_STATUS_LINES_CORE;

  tipEl.textContent = DEPLOY_TIPS[Math.floor(Math.random() * DEPLOY_TIPS.length)];
  statusEl.textContent = statusLines[0];
  let statusIdx = 0;
  const statusTimer = setInterval(() => {
    statusIdx = (statusIdx + 1) % statusLines.length;
    statusEl.textContent = statusLines[statusIdx];
  }, 700);

  let displayPct = 0; // smoothed value actually drawn — eased toward the real
                       // target each frame so the bar never jumps or stalls,
                       // even when a fetch resolves instantly from cache.
  let settled = false;
  let finished = false;

  // The animation loop ONLY drives the visual fill. Whether the game
  // actually starts is decided separately in finish(), below — tying
  // startGame() to requestAnimationFrame convergence would mean a slow
  // device, a low-power/throttled tab, or a backgrounded window (browsers
  // routinely drop background-tab rAF to ~1fps or less) could leave the
  // player stuck on a finished download for no reason.
  function tick() {
    if (finished) return;
    const target = settled ? 1 : AssetLoadTracker.overallFor(relevantUrls);
    displayPct += (target - displayPct) * 0.12;
    if (Math.abs(target - displayPct) < 0.002) displayPct = target;
    const shown = Math.round(displayPct * 100);
    barFillEl.style.width = shown + '%';
    pctEl.textContent = shown + '%';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(statusTimer);
    barFillEl.style.width = '100%';
    pctEl.textContent = '100%';
    loadingEl.classList.add('hidden');
    startGame();
  }

  const assetsReady = Promise.all([mainAssetsPromise, useStreet ? loadStreetModel() : Promise.resolve()]);
  // A short minimum display time so the screen always reads as an
  // intentional beat rather than a flash, even when everything was already
  // cached/loaded by the time the player reaches it.
  const minDisplay = new Promise((resolve) => setTimeout(resolve, 500));
  Promise.all([assetsReady, minDisplay]).then(() => { settled = true; finish(); });
  // Defensive hard cap — every loader above already catches its own
  // fetch/parse errors and resolves (never rejects) on failure, so this
  // should never actually be needed, but a loading screen that could in
  // theory hang forever is worse than one that occasionally proceeds early.
  setTimeout(() => { settled = true; finish(); }, 20000);
}

let pendingMapChoice = 'classic';
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('map-picker').classList.remove('hidden');
});
function selectMapChoice(key) {
  pendingMapChoice = key;
  document.getElementById('map-choice-classic').classList.toggle('selected', key === 'classic');
  document.getElementById('map-choice-street').classList.toggle('selected', key === 'street');
  // Kick off the street model's (large, ~13MB) fetch as soon as it's picked in
  // the list, giving it a head start while the player is still on the picker/
  // warning dialog. loadStreetModel() is cached, so this never double-fetches.
  if (key === 'street') loadStreetModel();
}
document.getElementById('map-choice-classic').addEventListener('click', () => selectMapChoice('classic'));
document.getElementById('map-choice-street').addEventListener('click', () => selectMapChoice('street'));
document.getElementById('map-choice-cancel').addEventListener('click', () => {
  document.getElementById('map-picker').classList.add('hidden');
});
document.getElementById('map-choice-confirm').addEventListener('click', () => {
  document.getElementById('map-picker').classList.add('hidden');
  activeMapKey = pendingMapChoice;
  const useStreet = activeMapKey === 'street';
  // Switch the sky, fog, ambient/direct lighting and palette with the selected theatre.
  if (typeof applyTheme === 'function') applyTheme(useStreet ? 'street' : 'dustline');
  streetGroup.visible = useStreet;
  // Re-target the shared sun (and its shadow camera) onto the street model's
  // center when that map is active, rather than leaving it fixed on the
  // classic arena's origin — keeps the same light angle (fixed offset from
  // target) but keeps its shadow frustum centered on whichever map's
  // content actually needs shadows.
  if (typeof sun !== 'undefined' && sun.target) {
    const targetZ = useStreet ? STREET_MODEL_CENTER_Z : 0;
    sun.target.position.set(0, 0, targetZ);
    sun.target.updateMatrixWorld();
    sun.position.set(36, 46, targetZ - 20);
  }
  // Keep Dustline Canyon intact, but hide its arena dressing when the
  // Abandoned Street map is selected.
  if (typeof floor !== 'undefined') floor.visible = !useStreet;
  if (typeof haze !== 'undefined') haze.visible = !useStreet;
  if (typeof envMeshes !== 'undefined') envMeshes.forEach(m => { m.visible = !useStreet; });
  if (typeof grassInst !== 'undefined') grassInst.visible = !useStreet;
  if (typeof pebbleInst !== 'undefined') pebbleInst.visible = !useStreet;
  if (typeof shaleInst !== 'undefined') shaleInst.visible = !useStreet;
  if (typeof scrubA !== 'undefined') scrubA.visible = !useStreet;
  if (typeof scrubB !== 'undefined') scrubB.visible = !useStreet;
  if (typeof road !== 'undefined') road.visible = !useStreet;
  if (typeof fencePosts !== 'undefined') fencePosts.visible = !useStreet;
  if (typeof fenceWire !== 'undefined') fenceWire.visible = !useStreet;
  // Keep the classic map's atmospheric road/decals out of the other map.
  scene.traverse(o => {
    if (o.userData && o.userData.classicOnly) o.visible = !useStreet;
  });
  if (useStreet) {
    document.getElementById('graphics-warning').classList.remove('hidden');
  } else {
    beginDeployment();
  }
});
document.getElementById('graphics-continue').addEventListener('click', () => {
  document.getElementById('graphics-warning').classList.add('hidden');
  beginDeployment();
});
document.getElementById('graphics-cancel').addEventListener('click', () => {
  document.getElementById('graphics-warning').classList.add('hidden');
  document.getElementById('map-picker').classList.remove('hidden');
});
document.getElementById('respawn-btn').addEventListener('click', startGame);
document.getElementById('death-menu-btn').addEventListener('click', () => {
  document.getElementById('death-overlay').classList.add('hidden');
  showScreen('main-menu');
  updateXPHud();
  refreshMenuTacticalStatus();
  // Bring the tactical menu music back after a completed match.
  stopCombatMusic();
  initAudio();
  resumeAudio();
  startMenuMusic();
});

