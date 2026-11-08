/* ============================================================
   HUD updates
   ============================================================ */
function updateHealthHUD() {
  document.getElementById('health-bar-inner').style.width = (player.health / player.maxHealth * 100) + '%';
  document.getElementById('health-num').textContent = `${Math.round(player.health)} / ${player.maxHealth}`;
  document.getElementById('dmg-vignette').classList.toggle('low-health', player.health > 0 && player.health / player.maxHealth < 0.3);
}
function updateAmmoHUD() {
  document.getElementById('weapon-name').textContent = weapon.name + (lmgDeployed ? ' — DEPLOYED' : '');
  document.getElementById('ammo-count').innerHTML = weapon.melee ? 'MELEE' : `${weapon.mag}<span> / ${weapon.reserve}</span>`;
}
function updateKillHUD() {
  document.getElementById('kill-count').innerHTML = `${stats.kills} <span style="color:var(--bone-dim); font-size:14px;">DOWNED</span>`;
}

function updateWaveHUD() {
  const remaining = Math.max(0, WaveManager.totalThisWave - WaveManager.killedThisWave);
  document.getElementById('wave-label').textContent = 'WAVE ' + String(WaveManager.wave).padStart(2, '0');
  document.getElementById('hostiles-label').innerHTML = remaining + ' <span>HOSTILES</span>';
}
function updateScoreHud() {
  document.getElementById('score-value').textContent = matchStats.score.toLocaleString();
  const streakEl = document.getElementById('streak-indicator');
  if (matchStats.streak >= 2) {
    streakEl.textContent = matchStats.streak + 'x STREAK';
    streakEl.classList.remove('hidden');
  } else {
    streakEl.classList.add('hidden');
  }
}
function showWaveBanner(n) {
  const el = document.getElementById('wave-banner');
  el.querySelector('.wb-title').textContent = 'WAVE ' + String(n).padStart(2, '0');
  el.querySelector('.wb-sub').textContent = WaveManager.totalThisWave + ' HOSTILES';
  el.classList.add('show');
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => { el.classList.remove('show'); }, 2200);
}
function showWaveCleared() {
  const el = document.getElementById('wave-banner');
  el.querySelector('.wb-title').textContent = 'WAVE CLEARED';
  el.querySelector('.wb-sub').textContent = 'PREPARING NEXT WAVE';
  el.classList.add('show');
  sfxWaveClear();
  clearTimeout(showWaveBanner._t);
  showWaveBanner._t = setTimeout(() => { el.classList.remove('show'); }, 2400);
}
function showStreakBanner(text) {
  const el = document.getElementById('streak-banner');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sfxStreak();
}
function showScorePopup(pts, label) {
  const el = document.getElementById('score-popup');
  el.querySelector('.sp-pts').textContent = '+' + pts;
  el.querySelector('.sp-label').textContent = label;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function showLevelUp(level) {
  const el = document.getElementById('levelup-banner');
  el.querySelector('.lu-level').textContent = 'LEVEL ' + String(level).padStart(2, '0');
  el.classList.remove('hidden'); el.classList.add('show');
  sfxLevelUp();
  clearTimeout(showLevelUp._t);
  showLevelUp._t = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.classList.add('hidden'), 400); }, 2200);
}
function showEliteWarning() {
  const el = document.getElementById('elite-warning');
  el.classList.remove('hidden'); el.classList.add('show');
  clearTimeout(showEliteWarning._t);
  showEliteWarning._t = setTimeout(() => { el.classList.remove('show'); }, 3000);
}

