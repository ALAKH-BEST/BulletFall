/* ============================================================
   WAVES — built entirely on the existing 5-bot pool. Each bot slot
   respawns as the next queued archetype until the wave's total is
   spawned; once every queued enemy is dead, the wave is cleared.
   ============================================================ */
const WaveManager = { wave: 0, totalThisWave: 0, spawnedThisWave: 0, killedThisWave: 0, active: false, transitioning: false };
function waveEnemyCount(w) {
  const table = [5, 7, 8, 10, 12];
  if (w - 1 < table.length) return table[w - 1];
  return 12 + (w - 5) * 2;
}
function archetypeForSpawn(waveNum, idx) {
  if (waveNum >= 3 && idx > 0 && idx % 8 === 0) return 'elite';
  const roll = Math.random();
  if (waveNum >= 4 && roll < 0.18) return 'heavy';
  if (waveNum >= 2 && roll < 0.34) return 'sniper';
  if (waveNum >= 1 && roll < 0.55) return 'rusher';
  return 'normal';
}
function startWave(n) {
  WaveManager.wave = n;
  WaveManager.totalThisWave = waveEnemyCount(n);
  WaveManager.spawnedThisWave = Math.min(bots.length, WaveManager.totalThisWave);
  WaveManager.killedThisWave = 0;
  WaveManager.active = true;
  WaveManager.transitioning = false;
  for (let i = 0; i < bots.length; i++) {
    if (i < WaveManager.totalThisWave) {
      bots[i].setArchetype(archetypeForSpawn(n, i));
      bots[i].reset();
    } else {
      bots[i].alive = false;
      bots[i].group.visible = false;
    }
  }
  save.daily.waveReached = Math.max(save.daily.waveReached, n);
  persistSave();
  checkDailyMissions();
  updateWaveHUD();
  showWaveBanner(n);
  const eliteAlive = bots.some(b => b.alive && b.type === 'elite');
  if (eliteAlive) showEliteWarning();
  setCombatIntensity(eliteAlive ? 'elite' : (n >= 5 ? 'high' : 'low'));
}
function checkWaveClear() {
  if (!WaveManager.active || WaveManager.transitioning) return;
  const anyAlive = bots.some(b => b.alive);
  const anyPending = WaveManager.spawnedThisWave < WaveManager.totalThisWave;
  if (!anyAlive && !anyPending) {
    WaveManager.active = false;
    WaveManager.transitioning = true;
    showWaveCleared();
    setTimeout(() => { startWave(WaveManager.wave + 1); }, 2600);
  }
}

/* ============================================================
   SCORE / STREAKS
   ============================================================ */
const matchStats = { score: 0, streak: 0, bestStreak: 0, lastKillTime: -99, headshots: 0, kills: 0, xpEarned: 0 };
function awardKill(bot, isHeadshot, isLongRange) {
  const now = performance.now() / 1000;
  matchStats.streak = (now - matchStats.lastKillTime < 4) ? matchStats.streak + 1 : 1;
  matchStats.lastKillTime = now;
  matchStats.bestStreak = Math.max(matchStats.bestStreak, matchStats.streak);
  matchStats.kills++;
  if (isHeadshot) matchStats.headshots++;

  let pts = 100;
  let label = 'KILL';
  if (isHeadshot) { pts += 50; label = 'HEADSHOT'; }
  if (isLongRange) pts += 100;
  if (bot.type === 'elite') pts += 400;
  if (matchStats.streak === 2) pts += 50;
  else if (matchStats.streak === 3) pts += 100;
  else if (matchStats.streak >= 5) pts += 200;

  matchStats.score += pts;
  showScorePopup(pts, label);
  updateScoreHud();

  const xpAmount = 40 + (isHeadshot ? 20 : 0) + (bot.type === 'elite' ? 150 : 0);
  matchStats.xpEarned += xpAmount;
  grantXP(xpAmount);

  save.daily.kills++;
  if (isHeadshot) save.daily.headshots++;
  persistSave();
  checkDailyMissions();

  if (matchStats.streak === 2) showStreakBanner('DOUBLE KILL');
  else if (matchStats.streak === 3) showStreakBanner('TRIPLE KILL');
  else if (matchStats.streak === 5) showStreakBanner('RAMPAGE');
  else if (matchStats.streak >= 10 && matchStats.streak % 5 === 0) showStreakBanner('UNSTOPPABLE');

  updateWaveHUD();
}

