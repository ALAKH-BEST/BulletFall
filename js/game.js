/* THREE is loaded globally by the classic <script> tag above */

/* ============================================================
   CONFIG
   ============================================================ */
const CFG = {
  gravity: -24,
  jumpSpeed: 8.2,
  playerSpeed: 6.2,
  playerRadius: 0.4,
  eyeHeight: 1.65,
  arenaHalf: 36,
  mouseSens: 0.0022,
  touchLookSens: 0.0045,
  bot: {
    health: 60,
    speed: 3.1,
    detectRadius: 17,
    attackRange: 9.5,
    attackInterval: 1.15,
    damageMin: 5,
    damageMax: 11,
    respawnDelay: 3.5,
  }
};

/* ============================================================
   THEMES — palette swaps applied to shared geometry/materials
   ============================================================ */
const THEMES = {
  dustline: {
    name: 'Dustline Canyon',
    swatch: ['#f2b878', '#d97a4a', '#8a6a3f'],
    sky: { top: 0x3d3a63, mid: 0xd97a4a, bottom: 0xf2b878 },
    fog: { color: 0x3a2818, density: 0.012 },
    sun: { light: 0xffb066, disc: 0xffd9a0 },
    hemi: { sky: 0xffcf9e, ground: 0x4a3320 },
    fill: 0x5f7fa8,
    wall: 0x5a4530,
    floor: { base: '#a3814f', patchA: '#8a6a3f', patchB: '#b69260', speckleDark: 'rgba(60,42,20,', speckleLight: 'rgba(220,190,140,', seam: 'rgba(50,34,16,0.18)', crack: 'rgba(40,28,14,0.35)' },
    crate1: { base: '#c96a35', band: '#5a3a22' },
    crate2: { base: '#6f8259', band: '#3a4530' },
    rockTint: 0xffffff,
    grass: 0x8a7a3f,
    exposure: 1.12, hemiIntensity: 0.65, sunIntensity: 1.15,
  },
  frostbound: {
    name: 'Frostbound',
    swatch: ['#bcd6ea', '#4a6fa5', '#1c2a4a'],
    sky: { top: 0x0e1730, mid: 0x3a5c8a, bottom: 0xbcd6ea },
    fog: { color: 0x22314a, density: 0.013 },
    sun: { light: 0xdceeff, disc: 0xeaf6ff },
    hemi: { sky: 0xdcefff, ground: 0x2a3550 },
    fill: 0x8fa8c9,
    wall: 0x5c6a78,
    floor: { base: '#d7e4ec', patchA: '#b9cbd8', patchB: '#eef6fa', speckleDark: 'rgba(90,110,130,', speckleLight: 'rgba(255,255,255,', seam: 'rgba(70,90,110,0.18)', crack: 'rgba(60,80,100,0.3)' },
    crate1: { base: '#4a6b7a', band: '#233440' },
    crate2: { base: '#8a4a4f', band: '#3a2024' },
    rockTint: 0xcfe0ea,
    grass: 0x9fb8c2,
    exposure: 1.22, hemiIntensity: 0.75, sunIntensity: 1.25,
  },
  nightshade: {
    name: 'Nightshade',
    swatch: ['#7a2f6e', '#3a1560', '#0c0620'],
    sky: { top: 0x0c0620, mid: 0x3a1560, bottom: 0x7a2f6e },
    fog: { color: 0x160a28, density: 0.016 },
    sun: { light: 0xff5fd6, disc: 0xff8fe0 },
    hemi: { sky: 0x6a3fae, ground: 0x140820 },
    fill: 0x2fd6c9,
    wall: 0x2a2038,
    floor: { base: '#241c2e', patchA: '#1c1624', patchB: '#3a2a4a', speckleDark: 'rgba(10,6,16,', speckleLight: 'rgba(150,100,190,', seam: 'rgba(120,60,180,0.22)', crack: 'rgba(255,60,200,0.15)' },
    crate1: { base: '#7a2f6e', band: '#2a1030' },
    crate2: { base: '#245a55', band: '#0f2a28' },
    rockTint: 0x8a6aa8,
    grass: 0x4a3a5a,
    exposure: 0.92, hemiIntensity: 0.5, sunIntensity: 0.9,
  },
};
let currentThemeKey = 'dustline';

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* ============================================================
   SAVE SYSTEM — one consolidated localStorage key. Corrupted or
   missing data always falls back to safe defaults; never throws.
   Placed early since several systems (skins, XP) read/write 'save'
   at load time, before the rest of the game is built.
   ============================================================ */
const SAVE_KEY = 'bulletfall_save_v1';
function defaultSave() {
  return {
    xp: 0, level: 1,
    selectedSkin: 'default',
    sensitivity: 1, fov: 75,
    personalBests: { score: 0, wave: 0, streak: 0, kills: 0, accuracy: 0 },
    daily: { date: '', headshots: 0, kills: 0, waveReached: 0, claimed: {} },
  };
}
function loadSave() {
  const defaults = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? parsed.xp : defaults.xp,
      level: typeof parsed.level === 'number' && parsed.level >= 1 ? parsed.level : defaults.level,
      selectedSkin: typeof parsed.selectedSkin === 'string' ? parsed.selectedSkin : defaults.selectedSkin,
      sensitivity: typeof parsed.sensitivity === 'number' && parsed.sensitivity >= 0.3 && parsed.sensitivity <= 3 ? parsed.sensitivity : defaults.sensitivity,
      fov: typeof parsed.fov === 'number' && parsed.fov >= 60 && parsed.fov <= 100 ? parsed.fov : defaults.fov,
      personalBests: Object.assign({}, defaults.personalBests, parsed.personalBests || {}),
      daily: Object.assign({}, defaults.daily, parsed.daily || {}),
    };
  } catch (e) {
    return defaults;
  }
}
let save = loadSave();
function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable — continue without persisting */ }
}
{
  const todayStr = new Date().toISOString().slice(0, 10);
  if (save.daily.date !== todayStr) {
    save.daily = { date: todayStr, headshots: 0, kills: 0, waveReached: 0, claimed: {} };
    persistSave();
  }
}
const DAILY_MISSIONS = [
  { key: 'headshots', label: 'Get 15 headshots', target: 15, reward: 1000 },
  { key: 'kills', label: 'Kill 30 hostiles', target: 30, reward: 1000 },
  { key: 'waveReached', label: 'Reach wave 5', target: 5, reward: 1000 },
];

/* ============================================================
   XP / LEVELS
   ============================================================ */
function xpForLevel(lvl) { return 1000 + (lvl - 1) * 250; }
function grantXP(amount) {
  save.xp += amount;
  let leveled = false;
  while (save.xp >= xpForLevel(save.level)) {
    save.xp -= xpForLevel(save.level);
    save.level++;
    leveled = true;
  }
  persistSave();
  if (leveled) showLevelUp(save.level);
  updateXPHud();
}
const WEAPON_UNLOCK_LEVEL = { assault: 1, smg: 2, shotgun: 3, sniper: 6, lmg: 9 };

/* ============================================================
   AUDIO — lightweight synthesized WebAudio SFX (no external files).
   One shared noise buffer is reused by every noise-based sound; oscillator/
   gain nodes are cheap, short-lived, and auto-GC'd on stop (the normal
   WebAudio pattern). A simple voice cap prevents excessive overlap.
   ============================================================ */
let audioCtx = null, masterGain = null, noiseBuffer = null, audioMuted = false;
let activeVoices = 0;
const MAX_VOICES = 24;

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = audioMuted ? 0 : 0.7;
  masterGain.connect(audioCtx.destination);

  const len = Math.floor(audioCtx.sampleRate * 0.5);
  noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}
function resumeAudio() {
  if (!audioCtx) return Promise.resolve();
  if (audioCtx.state === 'suspended') {
    // Invoke resume directly from the player's start/pointer gesture so game
    // effects are ready immediately instead of waiting for a later interaction.
    return audioCtx.resume().catch(() => {});
  }
  return Promise.resolve();
}
function voiceDone() { activeVoices = Math.max(0, activeVoices - 1); }

/* Original procedural menu score: low cinematic drone, restrained pulse and distant metallic
   percussion. Generated locally by Web Audio; no downloaded or copyrighted audio asset. */
let menuMusicStarted = false, menuMusicTimer = null, menuMusicNodes = [];
let menuMusicEnabled = true;
try { menuMusicEnabled = localStorage.getItem('bulletfall_menu_music') !== 'off'; } catch (e) {}
function addMusicOsc(freq, type, gainValue, detune = 0) {
  if (!audioCtx || !masterGain) return null;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
  osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
  filter.type = 'lowpass'; filter.frequency.value = type === 'sawtooth' ? 520 : 900; filter.Q.value = .55;
  gain.gain.value = 0;
  osc.connect(filter); filter.connect(gain); gain.connect(masterGain); osc.start();
  gain.gain.setTargetAtTime(gainValue, audioCtx.currentTime, 0.22);
  menuMusicNodes.push({osc, gain, filter});
  return {osc, gain, filter};
}
function startMenuMusic() {
  if (menuMusicStarted || audioMuted || !menuMusicEnabled) return;
  initAudio(); resumeAudio();
  if (!audioCtx || !masterGain) return;
  menuMusicStarted = true;
  const drone1 = addMusicOsc(55, 'sawtooth', .055, -5);
  const drone2 = addMusicOsc(82.41, 'triangle', .035, 4);
  const drone3 = addMusicOsc(110, 'sine', .018, 0);
  if (drone1) { drone1.filter.frequency.value = 240; drone1.gain.gain.setTargetAtTime(.025, audioCtx.currentTime, 0.3); }
  if (drone2) { drone2.filter.frequency.value = 340; }
  if (drone3) { drone3.filter.frequency.value = .012; }
  const notes = [110, 130.81, 146.83, 98, 110, 164.81, 146.83, 87.31];
  let beat = 0;
  const tick = () => {
    if (!menuMusicStarted || !audioCtx || audioMuted) return;
    // Schedule slightly ahead of the JS timer callback to avoid late, uneven attacks.
    const t = audioCtx.currentTime + 0.035;
    const note = notes[beat % notes.length];
    // Sub-bass impact on alternating beats.
    if (beat % 2 === 0) {
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(74, t); osc.frequency.exponentialRampToValueAtTime(38, t + .28);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.085, t + .018); g.gain.exponentialRampToValueAtTime(.0001, t + .42);
      osc.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t + .44);
    }
    // Sparse minor-key metallic synth notes, deliberately quiet behind the menu.
    if (beat % 4 === 1) {
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain(), filt = audioCtx.createBiquadFilter();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(note, t); osc.frequency.exponentialRampToValueAtTime(note * .995, t + .55);
      filt.type = 'lowpass'; filt.frequency.value = 700;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.025, t + .035); g.gain.exponentialRampToValueAtTime(.0001, t + .62);
      osc.connect(filt); filt.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t + .65);
    }
    // Filtered noise creates a soft distant radio/metallic sweep every few bars.
    if (beat % 8 === 6) playNoise({duration:.42, filterType:'bandpass', freq:620, Q:.7, gain:.012, decay:.42});
    beat++;
    menuMusicTimer = setTimeout(tick, 620);
  };
  tick();
  const label = document.getElementById('menu-audio-label');
  if (label) label.textContent = 'TACTICAL SCORE // ACTIVE';
}
function stopMenuMusic() {
  if (!menuMusicStarted) return;
  menuMusicStarted = false;
  if (menuMusicTimer) clearTimeout(menuMusicTimer);
  menuMusicTimer = null;
  if (audioCtx) {
    const t = audioCtx.currentTime;
    menuMusicNodes.forEach(({osc, gain}) => {
      try { gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(0, t, .25); osc.stop(t + 1.1); } catch(e) {}
    });
  }
  menuMusicNodes = [];
  const label = document.getElementById('menu-audio-label');
  if (label) label.textContent = 'TACTICAL SCORE // STANDBY';
}
document.addEventListener('pointerdown', function menuAudioUnlock() {
  const menu = document.getElementById('main-menu');
  if (menu && !menu.classList.contains('hidden') && menuMusicEnabled) startMenuMusic();
}, {once:true});

/* ---------- dynamic combat music ----------
   Low-intensity loop during ordinary waves, a faster/louder layer once waves get
   dangerous (wave 5+), and a tense high layer while an elite is alive. All three
   are the same generator at different settings rather than separate tracks, so
   switching tiers is just changing numbers rather than crossfading audio files —
   kept intentionally simple and cheap. Entirely procedural Web Audio, same as the
   rest of the game's sound; respects the existing mute button and music toggle. */
let combatMusicStarted = false, combatMusicTimer = null, combatMusicBeat = 0, combatIntensity = 'low';
function setCombatIntensity(level) { combatIntensity = level; }
function startCombatMusic() {
  if (combatMusicStarted || audioMuted || !menuMusicEnabled) return;
  initAudio(); resumeAudio();
  if (!audioCtx || !masterGain) return;
  combatMusicStarted = true;
  combatMusicBeat = 0;
  const tick = () => {
    if (!combatMusicStarted || !audioCtx || audioMuted) return;
    const t = audioCtx.currentTime + 0.03;
    const elite = combatIntensity === 'elite';
    const high = combatIntensity === 'high' || elite;
    // Sub-bass pulse — the steady "heartbeat" under the fight.
    if (combatMusicBeat % (high ? 1 : 2) === 0) {
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(elite ? 66 : 54, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.22);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(elite ? 0.1 : 0.075, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.32);
    }
    // Filtered-noise tick — a dry, mechanical hat rather than a musical cymbal.
    if (combatMusicBeat % 2 === 1) {
      playNoise({ duration: 0.03, filterType: 'highpass', freq: elite ? 2700 : 2100, Q: 1, gain: elite ? 0.05 : 0.03, decay: 0.025 });
    }
    // Elite tier gets a sparse, dissonant high synth stab for tension.
    if (elite && combatMusicBeat % 6 === 3) {
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain(), filt = audioCtx.createBiquadFilter();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(233, t);
      filt.type = 'lowpass'; filt.frequency.value = 1100;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(filt); filt.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.52);
    }
    combatMusicBeat++;
    const interval = elite ? 250 : (high ? 320 : 430);
    combatMusicTimer = setTimeout(tick, interval);
  };
  tick();
}
function stopCombatMusic() {
  combatMusicStarted = false;
  if (combatMusicTimer) clearTimeout(combatMusicTimer);
  combatMusicTimer = null;
}

function playNoise({ duration = 0.1, filterType = 'bandpass', freq = 1200, Q = 1, gain = 0.4, decay = duration }) {
  if (!audioCtx || audioMuted || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType; filter.frequency.value = freq; filter.Q.value = Q;
  const g = audioCtx.createGain();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, duration * 0.12));
  g.gain.setTargetAtTime(0.0001, t + Math.min(0.012, duration * 0.12), Math.max(0.015, decay / 5));
  src.connect(filter); filter.connect(g); g.connect(masterGain);
  src.onended = voiceDone;
  src.start(t); src.stop(t + duration + 0.02);
}
function playTone({ freq = 440, duration = 0.08, type = 'square', gain = 0.3, freqEnd = null }) {
  if (!audioCtx || audioMuted || activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  const t = audioCtx.currentTime;
  osc.frequency.setValueAtTime(freq, t);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(g); g.connect(masterGain);
  osc.onended = voiceDone;
  osc.start(t); osc.stop(t + duration + 0.02);
}

/* ---- specific sound effects, one function per event ---- */
function sfxGunshot(weaponKey) {
  // Layered procedural gunshot: sharp broadband crack, a deep sub-bass "boom"
  // (the loud, chesty low end that gives tactical-shooter gunfire — e.g. the
  // AWP in CS:GO — its weight), a filtered mid body, a mechanical tail, and a
  // short slap-back echo for openness/distance. Entirely filtered noise, no
  // oscillator/tonal layer (that's what read as a synth "pew"), and no external
  // or copyrighted samples — just an original sound built in the same spirit.
  if (!audioCtx || audioMuted) return;
  const jitter = (v) => v * (0.94 + Math.random() * 0.12);
  const echo = (baseFreq, baseGain, count, spacing, decayMul) => {
    for (let i = 1; i <= count; i++) {
      setTimeout(() => {
        playNoise({ duration: 0.09, filterType: 'lowpass', freq: baseFreq * Math.pow(0.82, i), Q: 0.5, gain: baseGain * Math.pow(decayMul, i), decay: 0.09 });
      }, spacing * i);
    }
  };
  if (weaponKey === 'shotgun') {
    playNoise({ duration: 0.03, filterType: 'highpass', freq: jitter(2000), Q: 0.7, gain: 0.74, decay: 0.022 });
    playNoise({ duration: 0.09, filterType: 'lowpass', freq: jitter(115), Q: 0.6, gain: 0.5, decay: 0.085 });
    playNoise({ duration: 0.2, filterType: 'lowpass', freq: jitter(260), Q: 0.6, gain: 0.6, decay: 0.19 });
    playNoise({ duration: 0.11, filterType: 'bandpass', freq: jitter(1100), Q: 0.8, gain: 0.26, decay: 0.1 });
    setTimeout(() => { playNoise({ duration: 0.05, filterType: 'highpass', freq: 3200, Q: 1.3, gain: 0.11, decay: 0.045 }); }, 70);
    echo(500, 0.16, 2, 95, 0.55);
  } else if (weaponKey === 'sniper') {
    playNoise({ duration: 0.025, filterType: 'highpass', freq: jitter(2600), Q: 0.8, gain: 0.85, decay: 0.018 });
    playNoise({ duration: 0.13, filterType: 'lowpass', freq: jitter(90), Q: 0.55, gain: 0.74, decay: 0.12 });
    playNoise({ duration: 0.26, filterType: 'lowpass', freq: jitter(220), Q: 0.55, gain: 0.66, decay: 0.25 });
    playNoise({ duration: 0.17, filterType: 'bandpass', freq: jitter(1600), Q: 0.75, gain: 0.36, decay: 0.16 });
    setTimeout(() => { playNoise({ duration: 0.08, filterType: 'bandpass', freq: 1900, Q: 0.8, gain: 0.16, decay: 0.075 }); }, 95);
    echo(420, 0.22, 3, 130, 0.6);
  } else {
    playNoise({ duration: 0.02, filterType: 'highpass', freq: jitter(2900), Q: 0.8, gain: 0.62, decay: 0.016 });
    playNoise({ duration: 0.07, filterType: 'lowpass', freq: jitter(130), Q: 0.55, gain: 0.3, decay: 0.065 });
    playNoise({ duration: 0.1, filterType: 'lowpass', freq: jitter(280), Q: 0.55, gain: 0.4, decay: 0.095 });
    playNoise({ duration: 0.07, filterType: 'bandpass', freq: jitter(1700), Q: 0.9, gain: 0.25, decay: 0.065 });
    setTimeout(() => { playNoise({ duration: 0.03, filterType: 'highpass', freq: 3800, Q: 1.1, gain: 0.09, decay: 0.028 }); }, 32);
    echo(560, 0.1, 1, 80, 0.5);
  }
}
function sfxReloadStart(weaponKey) {
  // Procedural handling sounds: metal/plastic contact, magazine release and movement.
  // Pure filtered-noise clicks only — no oscillator undertone — so the mechanism
  // reads as metal/polymer contact rather than a musical "boop".
  if (!audioCtx || audioMuted) return;
  const tick = (delay, freq, gain=.16) => setTimeout(() => {
    playNoise({duration:.032,filterType:'bandpass',freq,Q:2.4,gain,decay:.028});
  }, delay);
  const clack = (delay, freq=1100, gain=.2) => setTimeout(() => {
    playNoise({duration:.022,filterType:'highpass',freq,Q:1.5,gain,decay:.02});
  }, delay);
  if (weaponKey === 'shotgun') {
    // Pump/receiver release and shell handling.
    tick(0,720,.2); clack(100,1850,.16); tick(260,510,.18);
  } else if (weaponKey === 'sniper') {
    // Bolt handle lifts, bolt runs back and magazine/receiver clicks.
    tick(0,620,.19); clack(130,2200,.16); tick(300,840,.18); clack(460,1550,.14);
  } else {
    // Rifle magazine catch and the magazine leaving the magwell.
    clack(0,1750,.18); tick(110,680,.2); tick(270,920,.17);
  }
}
function sfxReloadDone(weaponKey) {
  if (!audioCtx || audioMuted) return;
  const tick = (delay, freq, gain=.17) => setTimeout(() => {
    playNoise({duration:.028,filterType:'highpass',freq,Q:1.8,gain,decay:.025});
  }, delay);
  if (weaponKey === 'shotgun') {
    // Shell seating followed by a firm action close.
    tick(0,1350,.18); tick(120,850,.2); tick(230,1850,.17);
  } else if (weaponKey === 'sniper') {
    // Bolt closes and locks into battery.
    tick(0,780,.17); tick(105,2050,.19); tick(210,1120,.16);
  } else {
    // Magazine seats, then a short charging-handle/bolt release snap.
    tick(0,980,.2); tick(115,2250,.18); tick(220,1450,.13);
  }
}
function sfxBotImpact(isHeadshot=false, weaponKey='assault') {
  // A body hit should be a dull, short impact rather than another electronic beep.
  // Built entirely from filtered noise — the earlier pitched triangle "thonk"
  // is what made it read as a game chime instead of a real strike.
  if (!audioCtx || audioMuted) return;
  const variation = .92 + Math.random()*.16;
  if (isHeadshot) {
    playNoise({duration:.05,filterType:'bandpass',freq:variation*1100,Q:1.1,gain:.26,decay:.045});
    playNoise({duration:.08,filterType:'lowpass',freq:variation*340,Q:.6,gain:.22,decay:.07});
    setTimeout(()=>playNoise({duration:.04,filterType:'highpass',freq:3200,Q:1.3,gain:.1,decay:.035}),14);
  } else {
    playNoise({duration:.09,filterType:'lowpass',freq:variation*(weaponKey==='shotgun'?480:610),Q:.6,gain:.26,decay:.085});
    playNoise({duration:.05,filterType:'bandpass',freq:variation*1250,Q:.85,gain:.11,decay:.045});
  }
}
function sfxFootstep() {
  playNoise({ duration: 0.05, filterType: 'lowpass', freq: 300, Q: 0.5, gain: 0.16, decay: 0.05 });
}
function sfxJump() {
  // A felt push-off rather than a pitched "boing" sweep: a quick low thump from
  // the foot leaving the ground plus a soft fabric/gear rustle — no oscillator tone.
  playNoise({ duration: 0.065, filterType: 'lowpass', freq: 260, Q: 0.55, gain: 0.26, decay: 0.06 });
  playNoise({ duration: 0.05, filterType: 'bandpass', freq: 900, Q: 0.7, gain: 0.08, decay: 0.045 });
}
function sfxLand() {
  playNoise({ duration: 0.09, filterType: 'lowpass', freq: 200, Q: 0.5, gain: 0.32, decay: 0.09 });
  playNoise({ duration: 0.04, filterType: 'bandpass', freq: 700, Q: 0.8, gain: 0.09, decay: 0.035 });
}
function sfxHitMarker(isHeadshot) {
  playTone({ freq: isHeadshot ? 1700 : 1400, duration: 0.045, type: 'square', gain: 0.3 });
}
function sfxPlayerHurt() {
  playTone({ freq: 220, freqEnd: 120, duration: 0.14, type: 'sawtooth', gain: 0.3 });
}
function sfxBotDeath() {
  playTone({ freq: 380, freqEnd: 90, duration: 0.22, type: 'triangle', gain: 0.28 });
}
function sfxWeaponSwitch() {
  playTone({ freq: 700, duration: 0.04, type: 'square', gain: 0.18 });
  setTimeout(() => playTone({ freq: 500, duration: 0.04, type: 'square', gain: 0.16 }), 60);
}
function sfxWaveClear() {
  playTone({ freq: 440, freqEnd: 660, duration: 0.16, type: 'triangle', gain: 0.28 });
  setTimeout(() => playTone({ freq: 660, freqEnd: 880, duration: 0.22, type: 'triangle', gain: 0.26 }), 120);
}
function sfxStreak() {
  playTone({ freq: 520, freqEnd: 780, duration: 0.1, type: 'square', gain: 0.25 });
}
function sfxLevelUp() {
  playTone({ freq: 500, duration: 0.08, type: 'triangle', gain: 0.25 });
  setTimeout(() => playTone({ freq: 750, duration: 0.14, type: 'triangle', gain: 0.28 }), 90);
}
function sfxPickupAmmo() {
  playTone({ freq: 620, freqEnd: 900, duration: 0.07, type: 'square', gain: 0.22 });
  setTimeout(() => playTone({ freq: 900, duration: 0.05, type: 'square', gain: 0.16 }), 55);
}
function sfxPickupHealth() {
  playTone({ freq: 480, freqEnd: 760, duration: 0.09, type: 'sine', gain: 0.24 });
  setTimeout(() => playTone({ freq: 760, freqEnd: 1040, duration: 0.11, type: 'sine', gain: 0.22 }), 80);
}

document.getElementById('mute-btn').addEventListener('click', () => {
  initAudio();
  audioMuted = !audioMuted;
  if (masterGain) masterGain.gain.value = audioMuted ? 0 : 0.7;
  document.getElementById('mute-btn').textContent = audioMuted ? '🔇' : '🔊';
  const menu = document.getElementById('main-menu');
  if (!audioMuted && menu && !menu.classList.contains('hidden')) startMenuMusic();
  if (audioMuted) {
    // Preserve the user's mute choice; stop menu sequencing so it won't restart on its own.
    if (menuMusicStarted) stopMenuMusic();
    const label = document.getElementById('menu-audio-label');
    if (label) label.textContent = 'TACTICAL SCORE // MUTED';
  }
});

/* ============================================================
   SCENE / RENDERER
   ============================================================ */
const container = document.getElementById('app');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a2818, 0.024);

let skyMat, sunDiscMesh;
function buildSky() {
  const skyGeo = new THREE.SphereGeometry(280, 24, 16);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x3d3a63) },
      mid: { value: new THREE.Color(0xd97a4a) },
      bottom: { value: new THREE.Color(0xf2b878) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.05
          ? mix(mid, top, smoothstep(0.05, 0.9, h))
          : mix(bottom, mid, smoothstep(-0.15, 0.05, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sunGeo = new THREE.CircleGeometry(16, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, fog: false });
  sunDiscMesh = new THREE.Mesh(sunGeo, sunMat);
  sunDiscMesh.position.set(85, 46, -190);
  sunDiscMesh.lookAt(0, 46, 0);
  scene.add(sunDiscMesh);
}
buildSky();

const camera = new THREE.PerspectiveCamera(save.fov, window.innerWidth / window.innerHeight, 0.1, 340);
let baseFov = save.fov;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   LIGHTING — dusk canyon mood, pushed for cinematic contrast
   ============================================================ */
const hemi = new THREE.HemisphereLight(0xffcf9e, 0x4a3320, 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffb066, 1.35);
sun.position.set(36, 46, -20);
sun.castShadow = true;
const shadowRes = isTouch ? 1024 : 2048;
sun.shadow.mapSize.set(shadowRes, shadowRes);
const shadowExtent = CFG.arenaHalf + 6;
sun.shadow.camera.left = -shadowExtent; sun.shadow.camera.right = shadowExtent;
sun.shadow.camera.top = shadowExtent; sun.shadow.camera.bottom = -shadowExtent;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0018;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x5f7fa8, 0.22);
fillLight.position.set(-14, 12, 14);
scene.add(fillLight);

// rim/edge light — low warm backlight opposite the sun, separates characters/structures
// from the background for a more cinematic silhouette read. No shadows (cheap).
const rimLight = new THREE.DirectionalLight(0xffddb0, 0.35);
rimLight.position.set(-30, 10, -34);
scene.add(rimLight);

/* ============================================================
   ARENA — geometry + collision boxes
   ============================================================ */
const collidables = []; // {min:{x,z}, max:{x,z}}
const envMeshes = []; // for raycast blocking

/* ============================================================
   TERRAIN HEIGHT — flat (0) everywhere except the sniper-perch ramp/platform.
   Keeps the existing flat-ground physics model intact; this is a lookup the
   player/bot ground-snap code calls instead of a hardcoded 0. Declared early
   since the perch's visual meshes (built further down) reference it at load time.
   ============================================================ */
const PERCH = { xMin: 25, xMax: 33, rampZTop: -14, rampZBottom: -30, platZMin: -35, platZMax: -30, height: 4.5 };
function getGroundHeight(x, z) {
  if (x < PERCH.xMin || x > PERCH.xMax) return 0;
  if (z <= PERCH.rampZTop && z >= PERCH.rampZBottom) {
    const t = (PERCH.rampZTop - z) / (PERCH.rampZTop - PERCH.rampZBottom);
    return t * PERCH.height;
  }
  if (z < PERCH.rampZBottom && z >= PERCH.platZMin) return PERCH.height;
  return 0;
}

function addCollider(minX, minZ, maxX, maxZ, map = 'classic') {
  collidables.push({ min: { x: minX, z: minZ }, max: { x: maxX, z: maxZ }, map });
}

// Floor — subdivided into a grid and displaced with gentle low-poly noise for real
// terrain relief (slopes/dips/rock variation). This is a VISUAL-ONLY heightfield: the
// player/bot ground-snap logic still uses getGroundHeight() (flat 0, except PERCH), so
// the noise amplitude is kept small and is explicitly flattened over the PERCH ramp/
// platform, the central road, and the spawn point to avoid any visible mismatch with
// the collision the game actually simulates. One mesh, one draw call, same as before.
// Map selection state and Arctic-only scene group must exist before terrain textures are built.
const arcticGroup = new THREE.Group();
scene.add(arcticGroup);
arcticGroup.visible = false;
let activeMapKey = 'classic';
const classicEnvironmentObjects = [];

const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true });
const FLOOR_SEGS = 64;
const floorGeo = new THREE.PlaneGeometry(CFG.arenaHalf * 2, CFG.arenaHalf * 2, FLOOR_SEGS, FLOOR_SEGS);

// cheap layered-sine pseudo-noise — no external noise library needed
function terrainNoise(x, z) {
  let h = Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.05 - 0.4) * 0.55;
  h += Math.sin(x * 0.1 - 2.3 + z * 0.035) * 0.28;
  h += Math.sin(x * 0.22 + z * 0.19 + 4.1) * 0.12;
  // intentional large-scale shaping tied to named areas, not just noise —
  // the compound sits on a broad natural rise (defensive high ground),
  // and a shallow valley/wash runs from the center toward the canyon route
  const compoundRise = Math.exp(-((x + 24) * (x + 24) + (z + 22) * (z + 22)) / (22 * 22)) * 2.6;
  const valleyD = distToSegment(x, z, 4, 4, 24, 2);
  const valley = Math.exp(-(valleyD * valleyD) / (7 * 7)) * -1.1;
  return h + compoundRise + valley;
}
// smoothstep falloff: 0 inside the flattened radius, ramping to 1 by radius+feather
function flattenFalloff(dist, radius, feather) {
  if (dist <= radius) return 0;
  const t = Math.min(1, (dist - radius) / feather);
  return t * t * (3 - 2 * t);
}
// named zone centers, reused for both ground-color blending and the visual road/paths
const ZONES = {
  center: { x: 0, z: 2, color: new THREE.Color(0xb8925a), radius: 15 },       // baseline sand (central combat zone)
  compound: { x: -24, z: -22, color: new THREE.Color(0x6b6142), radius: 16 }, // dirt/olive
  canyon: { x: 30, z: 0, color: new THREE.Color(0x8a8680), radius: 18 },      // grey rock
  perch: { x: 29, z: -25, color: new THREE.Color(0x93897c), radius: 14 },     // rocky vantage
};
const pathLines = [
  [ZONES.center, ZONES.compound],
  [ZONES.center, ZONES.canyon],
  [ZONES.canyon, ZONES.perch],
];
function distToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1)));
  const cx = ax + abx * t, cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

{
  const pos = floorGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX ? pos.getX(i) : pos.array[i * 3];
    const wyLocal = pos.getY ? pos.getY(i) : pos.array[i * 3 + 1];
    const wz = -wyLocal; // matches the -90° X rotation applied to the mesh below

    // --- height displacement, dampened flat over PERCH / road / spawn ---
    let amp = 0.22;
    const dPerch = Math.max(0, wx - PERCH.xMax, PERCH.xMin - wx, wz - PERCH.rampZTop, PERCH.platZMin - wz);
    if (wx > PERCH.xMin - 4 && wx < PERCH.xMax + 4 && wz < PERCH.rampZTop + 4 && wz > PERCH.platZMin - 4) {
      amp *= flattenFalloff(dPerch <= 0 ? 0 : dPerch, 0, 4);
    }
    const roadFlat = (wz > -27 && wz < 20 && Math.abs(wx) < 8);
    if (roadFlat) amp *= flattenFalloff(Math.max(0, Math.abs(wx) - 3.5), 0, 4.5);
    const spawnDist = Math.hypot(wx - 0, wz - 6);
    if (spawnDist < 8) amp *= flattenFalloff(spawnDist, 3, 5);
    const h = terrainNoise(wx, wz) * amp;
    if (pos.setZ) pos.setZ(i, h); else pos.array[i * 3 + 2] = h;

    // --- vertex color: blend named zone tints, then lighten along the connecting paths ---
    let r = 1, g = 1, b = 1; // neutral baseline — texture shows through unmodified by default
    for (const key in ZONES) {
      const zn = ZONES[key];
      const d = Math.hypot(wx - zn.x, wz - zn.z);
      const w = Math.max(0, 1 - d / zn.radius);
      if (w > 0) {
        const w2 = w * w * (3 - 2 * w);
        r += (zn.color.r - 1) * w2 * 0.85;
        g += (zn.color.g - 1) * w2 * 0.85;
        b += (zn.color.b - 1) * w2 * 0.85;
      }
    }
    // worn paths connecting the zones — subtle lightening/desaturation near the travel lines
    let pathW = 0;
    for (const [a, bZone] of pathLines) {
      const d = distToSegment(wx, wz, a.x, a.z, bZone.x, bZone.z);
      pathW = Math.max(pathW, Math.max(0, 1 - d / 3.2));
    }
    if (pathW > 0) {
      const p2 = pathW * pathW * (3 - 2 * pathW) * 0.35;
      r += (1.12 - r) * p2; g += (1.06 - g) * p2; b += (0.95 - b) * p2;
    }
    tmpColor.setRGB(Math.max(0, r), Math.max(0, g), Math.max(0, b));
    const aoShade = 1 + Math.max(-0.16, Math.min(0.1, h * 0.35));
    colors[i * 3] = tmpColor.r * aoShade; colors[i * 3 + 1] = tmpColor.g * aoShade; colors[i * 3 + 2] = tmpColor.b * aoShade;
  }
  floorGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  floorGeo.computeVertexNormals();
}

const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;

scene.add(floor);
// Continuous pale snowfield overlay: fine granular texture plus irregular wind-scoured patches.
{
  const c=document.createElement('canvas'); c.width=1024; c.height=1024;
  const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1024,1024);
  grad.addColorStop(0,'#e5edf2'); grad.addColorStop(.48,'#cbd7e0'); grad.addColorStop(1,'#aebdc9');
  ctx.fillStyle=grad; ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<1250;i++){
    const x=Math.random()*1024,y=Math.random()*1024,r=5+Math.random()*34;
    const light=Math.random()>.43;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,light?'rgba(255,255,255,.2)':'rgba(62,81,98,.12)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  for(let i=0;i<22000;i++){
    const v=Math.random()>.52?255:65, a=.025+Math.random()*.045;
    ctx.fillStyle=`rgba(${v},${v===255?255:82},${v===255?255:98},${a})`;
    ctx.fillRect(Math.random()*1024,Math.random()*1024,1+Math.random()*2,1+Math.random()*2);
  }
  const snowTex=new THREE.CanvasTexture(c);
  snowTex.wrapS=snowTex.wrapT=THREE.RepeatWrapping;snowTex.repeat.set(2,2);
  const snowMesh=new THREE.Mesh(new THREE.PlaneGeometry(CFG.arenaHalf*2,CFG.arenaHalf*2),
    new THREE.MeshStandardMaterial({map:snowTex,color:0xffffff,roughness:.96,metalness:0,envMapIntensity:.25}));
  snowMesh.rotation.x=-Math.PI/2;snowMesh.position.y=.045;snowMesh.receiveShadow=true;
  arcticGroup.add(snowMesh);
}


function buildSandTexture(theme) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const f = activeMapKey === 'arctic' ? {
    base: '#cbd6df', patchA: '#e7eef3', patchB: '#9eafbd',
    speckleDark: 'rgba(48,65,80,', speckleLight: 'rgba(255,255,255,',
    seam: 'rgba(58,76,91,0.12)', crack: 'rgba(47,61,72,0.18)'
  } : theme.floor;

  // base color with soft mottled gradient
  ctx.fillStyle = f.base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const r = 30 + Math.random() * 90;
    const x = Math.random() * size, y = Math.random() * size;
    const shade = Math.random() > 0.5 ? f.patchA : f.patchB;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, shade + '55'); grad.addColorStop(1, shade + '00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // fine speckle noise for grain
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? f.speckleDark + '0.12)' : f.speckleLight + '0.10)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  // faint worn tile seams (organic, not a rigid grid)
  ctx.strokeStyle = f.seam; ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    let x = Math.random() * size, y = 0;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 90; y += size / 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // scattered small cracks/pebble dots
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = f.crack;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // dark stain blotches — oil/water grime patches
  for (let i = 0; i < 5; i++) {
    const sx = Math.random() * size, sy = Math.random() * size, sr = 18 + Math.random() * 40;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, 'rgba(15,12,8,0.22)'); grad.addColorStop(1, 'rgba(15,12,8,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * 0.6, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // loose gravel clusters
  for (let c = 0; c < 12; c++) {
    const cx = Math.random() * size, cy = Math.random() * size;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90,80,66,0.4)' : 'rgba(180,168,148,0.3)';
      ctx.fillRect(cx + (Math.random() - 0.5) * 26, cy + (Math.random() - 0.5) * 26, 1.5, 1.5);
    }
  }

  // Fine terrain breakup: low-contrast mineral grain and wind-swept sediment.
  // Keep this subtle so snow, sand, and rocky themes all retain their chosen palette.
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const len = 2 + Math.random() * 15;
    const alpha = 0.025 + Math.random() * 0.075;
    ctx.strokeStyle = Math.random() > 0.52
      ? `rgba(28,25,22,${alpha})`
      : `rgba(255,250,238,${alpha * 0.85})`;
    ctx.lineWidth = 0.35 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 2.8);
    ctx.stroke();
  }
  // Sparse angular mineral fragments with soft edges rather than uniform dots.
  for (let i = 0; i < 210; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const rx = 1.5 + Math.random() * 5.5, ry = 1 + Math.random() * 3.2;
    ctx.fillStyle = Math.random() > 0.5
      ? 'rgba(38,34,29,0.10)' : 'rgba(255,250,242,0.13)';
    ctx.beginPath();
    ctx.moveTo(x - rx, y - ry * 0.2);
    ctx.lineTo(x - rx * 0.25, y - ry);
    ctx.lineTo(x + rx, y - ry * 0.3);
    ctx.lineTo(x + rx * 0.55, y + ry);
    ctx.lineTo(x - rx * 0.65, y + ry * 0.65);
    ctx.closePath();
    ctx.fill();
  }
  // Hairline erosion cracks, irregular and low contrast.
  ctx.lineCap = 'round';
  for (let i = 0; i < 28; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    ctx.strokeStyle = `rgba(40,35,30,${0.06 + Math.random() * 0.09})`;
    ctx.lineWidth = 0.5 + Math.random() * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 18;
      y += 3 + Math.random() * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvas;
}

function buildRoughnessTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bbbbbb'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const v = 140 + Math.random() * 100;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return canvas;
}

const gridTex = new THREE.CanvasTexture(document.createElement('canvas'));
gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
gridTex.repeat.set(9, 9);
gridTex.anisotropy = 8;
gridTex.encoding = THREE.sRGBEncoding;
floorMat.map = gridTex;
floorMat.bumpMap = gridTex;
floorMat.bumpScale = 0.035;

const roughTex = new THREE.CanvasTexture(buildRoughnessTexture(512));
roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
roughTex.repeat.set(9, 9);
floorMat.roughnessMap = roughTex;
// Fine sand/gravel relief from the same procedural grain map. Kept deliberately
// subtle so the surface reads better under raking light without shimmer/pop.
floorMat.bumpMap = roughTex;
floorMat.bumpScale = 0.075;
floorMat.needsUpdate = true;

// Central road strip — decorative asphalt overlay running through the combat zone,
// ties the area together visually. No collision; sits just above the sand to avoid z-fighting.
const roadCanvas = document.createElement('canvas');
roadCanvas.width = 128; roadCanvas.height = 512;
{
  const rctx = roadCanvas.getContext('2d');
  rctx.fillStyle = '#2b2621'; rctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 1400; i++) {
    rctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)';
    rctx.fillRect(Math.random() * 128, Math.random() * 512, 2, 2);
  }
  // tire marks — two darker parallel bands, slightly wandering
  rctx.strokeStyle = 'rgba(0,0,0,0.22)'; rctx.lineWidth = 10;
  [40, 88].forEach((baseX) => {
    rctx.beginPath();
    let x = baseX;
    rctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) { x = baseX + Math.sin(y * 0.02) * 4; rctx.lineTo(x, y); }
    rctx.stroke();
  });
  // cracks — thin jagged lines
  rctx.strokeStyle = 'rgba(10,8,6,0.5)'; rctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * 128, y = Math.random() * 512;
    rctx.beginPath(); rctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 26; y += (Math.random() - 0.5) * 26; rctx.lineTo(x, y); }
    rctx.stroke();
  }
  // potholes — dark patches with a lighter worn rim
  for (let i = 0; i < 6; i++) {
    const px = Math.random() * 128, py = Math.random() * 512, pr = 6 + Math.random() * 8;
    rctx.fillStyle = 'rgba(255,255,255,0.08)';
    rctx.beginPath(); rctx.ellipse(px, py, pr * 1.3, pr * 0.9, Math.random() * Math.PI, 0, Math.PI * 2); rctx.fill();
    rctx.fillStyle = 'rgba(5,4,3,0.55)';
    rctx.beginPath(); rctx.ellipse(px, py, pr, pr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2); rctx.fill();
  }
  // dirt buildup drifting in from the road edges
  for (let i = 0; i < 90; i++) {
    const fromLeft = Math.random() > 0.5;
    const y = Math.random() * 512;
    const x = fromLeft ? Math.random() * 22 : 128 - Math.random() * 22;
    rctx.fillStyle = `rgba(140,110,70,${0.06 + Math.random() * 0.1})`;
    rctx.fillRect(x, y, 3 + Math.random() * 4, 2 + Math.random() * 3);
  }
  // faded worn lane markings (dashes, patchier than a fresh road)
  rctx.fillStyle = 'rgba(210,190,120,0.4)';
  for (let y = 6; y < 512; y += 34) { if (Math.random() > 0.25) rctx.fillRect(60, y, 8, 18 * (0.6 + Math.random() * 0.4)); }
  // broken/crumbling road edges
  rctx.fillStyle = '#2b2621';
  for (let y = 0; y < 512; y += 14) {
    rctx.fillRect(0, y, 3 + Math.random() * 5, 10);
    rctx.fillRect(128 - 3 - Math.random() * 5, y, 8, 10);
  }
}
const roadTex = new THREE.CanvasTexture(roadCanvas);
roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
roadTex.repeat.set(1, 6);
roadTex.encoding = THREE.sRGBEncoding;
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 46), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.015, -4);
road.receiveShadow = true;
scene.add(road);

// Ground haze — a single large, very faint plane for atmospheric depth at distance.
// One mesh, theme-tinted alongside fog in applyTheme.
const hazeMat = new THREE.MeshBasicMaterial({ color: 0x3a2818, transparent: true, opacity: 0.22, fog: false, depthWrite: false });
const haze = new THREE.Mesh(new THREE.PlaneGeometry(CFG.arenaHalf * 2.6, CFG.arenaHalf * 2.6), hazeMat);
haze.rotation.x = -Math.PI / 2;
haze.position.y = 1.4;
scene.add(haze);


// ARCTIC OUTPOST MAP LAYER — snow drifts, ridgelines, cargo stacks and field structures.
// Instancing keeps the added silhouette detail relatively inexpensive.
// Arctic scene group and map state are initialized before terrain setup.
const arcticHemi = new THREE.HemisphereLight(0xdceeff, 0x526575, 1.15);
arcticHemi.visible = false; arcticGroup.add(arcticHemi);
const arcticSun = new THREE.DirectionalLight(0xfff4e5, 2.15);
arcticSun.position.set(-24, 42, -18); arcticSun.castShadow = true;
arcticSun.shadow.mapSize.set(2048,2048); arcticSun.shadow.camera.left=-48; arcticSun.shadow.camera.right=48;
arcticSun.shadow.camera.top=48; arcticSun.shadow.camera.bottom=-48; arcticSun.shadow.bias=-0.0015;
arcticSun.visible = false; arcticGroup.add(arcticSun);
const snowRockMat = new THREE.MeshStandardMaterial({color:0x8997a3, roughness:0.94, metalness:0.03, flatShading:false});
const snowCapMat = new THREE.MeshStandardMaterial({color:0xe1e9ee, roughness:0.92, metalness:0.0});
function makeArcticRidge(x,z,sx,sy,sz,seed){
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const x0=p.getX(i), y0=p.getY(i), z0=p.getZ(i);
    const noise=Math.sin(x0*7+seed)*Math.cos(z0*8-seed*.7)*.09 + Math.sin(y0*13+seed*2)*.035;
    p.setXYZ(i,x0*(1+noise),y0*(1+noise),z0*(1+noise));
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,snowRockMat);
  mesh.position.set(x,sy*.45,z); mesh.scale.set(sx,sy,sz);
  mesh.castShadow=true; mesh.receiveShadow=true; arcticGroup.add(mesh);
  const cap=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),snowCapMat);
  cap.position.set(x,sy*.75,z); cap.scale.set(sx*.92,sy*.38,sz*.92);
  cap.castShadow=true; cap.receiveShadow=true; arcticGroup.add(cap);
}
for(let i=0;i<20;i++){
  const side=i%2===0?-1:1, z=-31+Math.floor(i/2)*6.4;
  const rx=side*(31+Math.sin(i*2.3)*2), rsx=7+Math.random()*6, rsz=5+Math.random()*5;
  makeArcticRidge(rx,z,rsx,7+Math.random()*12,rsz,i*.73);
  addCollider(rx-rsx*.82, z-rsz*.82, rx+rsx*.82, z+rsz*.82, 'arctic');
}
// Weathered modular cargo containers around the forward compound.
const cargoMat = [
 new THREE.MeshStandardMaterial({color:0x343d45,roughness:.86,metalness:.35}),
 new THREE.MeshStandardMaterial({color:0x4b555d,roughness:.88,metalness:.25}),
 new THREE.MeshStandardMaterial({color:0x5b4039,roughness:.9,metalness:.2})
];
const cargoGeo=new THREE.BoxGeometry(4.6,2.3,2.15);
for(let i=0;i<14;i++){
 const side=i%2===0?-1:1, row=Math.floor(i/2);
 const mesh=new THREE.Mesh(cargoGeo,cargoMat[i%cargoMat.length]);
 mesh.position.set(side*(8.5+(row%3)*2.2),1.15,-8-row*3.2);
 addCollider(mesh.position.x-2.55, mesh.position.z-1.25, mesh.position.x+2.55, mesh.position.z+1.25, 'arctic');
 mesh.rotation.y=side*.05+(i%3)*.035; mesh.castShadow=true;mesh.receiveShadow=true;
 arcticGroup.add(mesh);
 const ribGeo=new THREE.BoxGeometry(.08,2.18,2.2);
 for(let r=0;r<9;r++){
   const rib=new THREE.Mesh(ribGeo,cargoMat[0]);
   rib.position.set(mesh.position.x-2.1+r*.52,1.15,mesh.position.z);
   rib.castShadow=true; arcticGroup.add(rib);
 }
}
// Defensive concrete blast barriers and a central command shelter.
const concreteMat=new THREE.MeshStandardMaterial({color:0x59636a,roughness:.95});
for(let i=0;i<8;i++){
 const b=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.05,.75),concreteMat);
 b.position.set(-6.8+i*1.95,.52,-4.2); b.rotation.y=(i%2?-.04:.04);
 b.castShadow=true;b.receiveShadow=true;arcticGroup.add(b);
 addCollider(b.position.x-1.35, b.position.z-.55, b.position.x+1.35, b.position.z+.55, 'arctic');
}
const shelter=new THREE.Mesh(new THREE.BoxGeometry(8,3.5,5.2),concreteMat);
shelter.position.set(0,1.75,-16); shelter.castShadow=true;shelter.receiveShadow=true; arcticGroup.add(shelter);
addCollider(-4.25, -18.8, 4.25, -13.0, 'arctic');
const roof=new THREE.Mesh(new THREE.BoxGeometry(8.7,.3,5.8),snowCapMat);
roof.position.set(0,3.62,-16);roof.castShadow=true;arcticGroup.add(roof);
const doorMat=new THREE.MeshStandardMaterial({color:0x151e25,roughness:.7,metalness:.25});
const door=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.5,.12),doorMat);
door.position.set(0,1.25,-13.35);arcticGroup.add(door);
const beaconMat=new THREE.MeshStandardMaterial({color:0xff6c35,emissive:0xc53812,emissiveIntensity:2.2});
for(const x of [-3.4,3.4]){
 const beacon=new THREE.Mesh(new THREE.BoxGeometry(.16,.55,.16),beaconMat);
 beacon.position.set(x,2.4,-13.3);arcticGroup.add(beacon);
}


// Snow berms around the approach create a visible transition from the spawn to the outpost.
const bermMat=new THREE.MeshStandardMaterial({color:0xd4dfe6,roughness:1});
for(let i=0;i<10;i++){
  const side=i%2===0?-1:1, z=-3-Math.floor(i/2)*3.6;
  const berm=new THREE.Mesh(new THREE.IcosahedronGeometry(1,3),bermMat);
  berm.position.set(side*(10.5+(i%3)*1.3),.6,z);
  berm.scale.set(2.2,1.05,1.65);berm.castShadow=true;berm.receiveShadow=true;arcticGroup.add(berm);
 addCollider(berm.position.x-1.8, berm.position.z-1.35, berm.position.x+1.8, berm.position.z+1.35, 'arctic');
}

// Boundary walls
const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 0.96, metalness: 0.015 });
const wallH = 6, wallT = 1;
function buildWall(cx, cz, w, d) {
  const geo = new THREE.BoxGeometry(w, wallH, d);
  const m = new THREE.Mesh(geo, wallMat);
  m.position.set(cx, wallH / 2, cz);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'rock';
  scene.add(m); envMeshes.push(m);
  addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
}
const H = CFG.arenaHalf;
buildWall(0, -H - wallT / 2, H * 2 + wallT * 2, wallT);
buildWall(0, H + wallT / 2, H * 2 + wallT * 2, wallT);
buildWall(-H - wallT / 2, 0, wallT, H * 2);
buildWall(H + wallT / 2, 0, wallT, H * 2);

// Cover crates — low-poly, stylized, own identity colors, with painted-panel detail
function buildCrateTexture(baseHex, bandHex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex; ctx.fillRect(0, 0, size, size);
  // plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * size / 4); ctx.lineTo(size, i * size / 4); ctx.stroke(); }
  // edge bands
  ctx.fillStyle = bandHex;
  ctx.fillRect(0, 0, size, 14); ctx.fillRect(0, size - 14, size, 14);
  ctx.fillRect(0, 0, 14, size); ctx.fillRect(size - 14, 0, 14, size);
  // rivets on bands
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  [18, size / 2, size - 18].forEach(p => {
    ctx.beginPath(); ctx.arc(p, 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p, size - 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, p, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(size - 7, p, 3, 0, Math.PI * 2); ctx.fill();
  });
  // scuffs / wear noise
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 4, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}
const crateMat1 = new THREE.MeshStandardMaterial({ map: buildCrateTexture(THEMES.dustline.crate1.base, THEMES.dustline.crate1.band), roughness: 0.8 });
const crateMat2 = new THREE.MeshStandardMaterial({ map: buildCrateTexture(THEMES.dustline.crate2.base, THEMES.dustline.crate2.band), roughness: 0.85 });
// Four of the largest crate spots ((-7,6), (-5,-5), (0,10), (-22,-14)) are deliberately
// left out here — they're where the real shipping-container model goes instead (see
// loadRealEnvProps below), so the same square footprint doesn't get a procedural crate
// AND a container stacked on top of each other.
const cratePositions = [
  [6, 0, 4, 2.2], [3, 0, -8, 2.0],
  [10, 0, -3, 2.2], [-11, 0, 2, 2.0],
  [8, 0, 9, 1.8],
  [22, 0, -18, 2.0],
  [24, 0, 14, 2.2], [-28, 0, 2, 2.0], [28, 0, -4, 2.4],
  [-14, 0, -26, 2.2], [16, 0, 26, 2.0], [4, 0, -22, 2.6],
  [-4, 0, 24, 2.2],
];
cratePositions.forEach(([x, , z, s], i) => {
  const geo = new THREE.BoxGeometry(s, s, s);
  const m = new THREE.Mesh(geo, i % 2 === 0 ? crateMat1 : crateMat2);
  m.position.set(x, s / 2, z);
  m.rotation.y = (i * 0.6) % Math.PI;
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'wood';
  scene.add(m); envMeshes.push(m);
  const half = s / 2 * 1.02;
  addCollider(x - half, z - half, x + half, z + half);
});

// Rock formations for atmosphere (low-poly, mostly decorative, a few collide)
const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, vertexColors: true });
function tintGeometryFaces(geo, baseColor, variance) {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIndexed.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(baseColor);
  for (let f = 0; f < pos.count; f += 3) {
    const shade = 1 + (Math.random() - 0.5) * variance;
    const c = base.clone().multiplyScalar(shade);
    for (let v = 0; v < 3; v++) { colors[(f + v) * 3] = c.r; colors[(f + v) * 3 + 1] = c.g; colors[(f + v) * 3 + 2] = c.b; }
  }
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return nonIndexed;
}
// Every buildRock() call registers here (x, z, s, plus the mesh + chip
// meshes it created) so a real-model swap can later hide the procedural
// version and clone a real boulder in its place at the same spot, without
// needing to touch any of the many buildRock() call sites below.
const rockRegistry = [];
function buildRock(x, z, s) {
  // Subdivided, multi-frequency displaced stone instead of a regular 20-face ico.
  const geo = new THREE.IcosahedronGeometry(s, 2);
  const p = geo.attributes.position;
  const basePositions = p.array.slice();
  for (let i = 0; i < p.count; i++) {
    const px = basePositions[i * 3], py = basePositions[i * 3 + 1], pz = basePositions[i * 3 + 2];
    const n1 = Math.sin(px * 2.13 + pz * 1.71 + x * .31) * Math.cos(py * 2.7 - z * .22);
    const n2 = Math.sin(px * 4.7 - py * 3.2 + z) * Math.cos(pz * 4.1 + x * .17);
    const n3 = Math.sin((px + pz) * 8.2 + py * 2.4);
    const radius = 1 + n1 * .085 + n2 * .045 + n3 * .018;
    p.setXYZ(i, px * radius, py * radius * .78, pz * radius);
  }
  geo.computeVertexNormals();
  const nonIndexed = geo.toNonIndexed();
  const pos = nonIndexed.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x78634d);
  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const face = new THREE.Vector3().subVectors(
      new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)),
      new THREE.Vector3(ax, ay, az)
    ).cross(new THREE.Vector3(
      pos.getX(i + 2) - ax, pos.getY(i + 2) - ay, pos.getZ(i + 2) - az
    )).normalize();
    const heightShade = THREE.MathUtils.clamp(.86 + ay / Math.max(s, .01) * .16, .68, 1.06);
    const faceShade = (0.84 + Math.random() * .24) * heightShade * (face.y > .55 ? 1.1 : 1);
    const c = base.clone().multiplyScalar(faceShade);
    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = c.r; colors[(i + v) * 3 + 1] = c.g; colors[(i + v) * 3 + 2] = c.b;
    }
  }
  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  nonIndexed.computeVertexNormals();
  const m = new THREE.Mesh(nonIndexed, rockMat);
  m.position.set(x, s * .48, z);
  m.scale.set(1.05, .88, 1.12);
  m.rotation.set(Math.random() * .25, Math.random() * Math.PI * 2, (Math.random() - .5) * .12);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'rock';
  scene.add(m); envMeshes.push(m);
  addCollider(x - s * .8, z - s * .8, x + s * .8, z + s * .8);

  // A few small broken strata chips visually merge each boulder into the ground.
  const chipMat = new THREE.MeshStandardMaterial({ color: 0x554536, roughness: 1, flatShading: true });
  const chips = [];
  for (let j = 0; j < 2; j++) {
    const chipGeo = new THREE.IcosahedronGeometry(s * (.18 + Math.random() * .09), 1);
    const chip = new THREE.Mesh(chipGeo, chipMat);
    const a = Math.random() * Math.PI * 2, d = s * (.55 + Math.random() * .25);
    chip.position.set(x + Math.cos(a) * d, .12 + Math.random() * .15, z + Math.sin(a) * d);
    chip.scale.set(1.25, .45, .85);
    chip.rotation.y = Math.random() * Math.PI;
    chip.castShadow = true; chip.receiveShadow = true;
    chip.userData.type = 'env'; chip.userData.surface = 'rock';
    scene.add(chip); envMeshes.push(chip);
    chips.push(chip);
  }
  rockRegistry.push({ x, z, s, mesh: m, chips });
}
buildRock(-16, -14, 2.6);
buildRock(15, 15, 3.0);
buildRock(-14, 15, 2.2);
buildRock(16, -15, 2.4);
buildRock(-30, -8, 3.4);
buildRock(30, 10, 3.8);
buildRock(-8, -30, 3.0);
buildRock(10, 30, 3.2);
buildRock(-26, 24, 4.4);
buildRock(18, -27, 5.0);
buildRock(-32, 28, 2.6);
buildRock(0, -32, 3.6);
// canyon/rock route — alternating boulders along the east edge form a walkable corridor
buildRock(31, 8, 2.8); buildRock(33, 3, 2.4);
buildRock(31, -2, 3.0); buildRock(33, -7, 2.6);

// Everything registered so far is a deliberately hand-placed rock the player
// will actually walk past/near — these are the ones worth swapping for a
// real boulder model. Below this point, dressBoundary() scatters ~40 more
// as far-edge silhouette-breaking padding; those stay procedural (cheap,
// rarely seen up close, and not worth the extra real-mesh instance count).
const rockSwapCutoff = rockRegistry.length;

// Boundary dressing — the four flat box walls above are what collision
// actually uses (untouched), but a bare rectangular slab reads as an
// invisible test-arena wall rather than a real place. Piling irregular rock
// clusters along and over them breaks the straight-line/right-angle
// silhouette that gives it away, especially at the corners where a perfect
// 90-degree joint is the biggest tell. Purely additive (own meshes + small
// colliders via buildRock), never changes the play-area rectangle itself.
(function dressBoundary() {
  const edge = H + wallT / 2;
  function cluster(cx, cz, count, spread, sizeMin, sizeMax) {
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * spread;
      const oz = (Math.random() - 0.5) * spread;
      const s = sizeMin + Math.random() * (sizeMax - sizeMin);
      buildRock(THREE.MathUtils.clamp(cx + ox, -edge - 6, edge + 6), THREE.MathUtils.clamp(cz + oz, -edge - 6, edge + 6), s);
    }
  }
  // Corners pile up the most — a clean right angle is the biggest giveaway.
  [[-edge, -edge], [edge, -edge], [-edge, edge], [edge, edge]].forEach(([cx, cz]) => {
    cluster(cx, cz, 4, 6, 2.6, 4.6);
  });
  // Mid-wall clusters along all four sides, straddling the wall line rather
  // than sitting flush against it, with gaps left near the center lanes/road
  // and the canyon-route corridor already built above so sightlines stay fair.
  [-0.5, -0.2, 0.2, 0.5].forEach((t) => {
    cluster(t * H * 2, -edge, 2, 4.5, 2.0, 3.6);
    cluster(t * H * 2, edge, 2, 4.5, 2.0, 3.6);
    if (Math.abs(t) > 0.3) { // leave the east canyon corridor (x~31-33) clear
      cluster(-edge, t * H * 2, 2, 4.5, 2.0, 3.6);
      cluster(edge, t * H * 2, 2, 4.5, 2.0, 3.6);
    }
  });
})();

// Low volumetric bush clusters — theme-tinted, scattered across the open
// ground (not just the boundary) to break up repeated crate/rock silhouettes
// with something organic and solid (the existing scrubA/scrubB billboards
// above are flat ground-clutter cards; these are small 3D clumps that read
// from any angle, including close up). Cheap: two low-poly meshes per cluster.
const bushMat = new THREE.MeshStandardMaterial({ color: 0x8a7a3f, roughness: 1, flatShading: true });
function buildBush(x, z, scale) {
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 * scale, 0), bushMat);
  base.position.set(x, 0.14 * scale, z);
  base.scale.set(1, 0.6, 1);
  base.rotation.y = Math.random() * Math.PI;
  base.castShadow = true; base.receiveShadow = true;
  base.userData.type = 'env'; base.userData.surface = 'wood';
  const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.38 * scale, 5), bushMat);
  sprig.position.set(x + 0.05 * scale, 0.26 * scale, z - 0.04 * scale);
  sprig.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
  sprig.castShadow = true;
  scene.add(base, sprig); envMeshes.push(base);
}
(function scatterBushes() {
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * (H * 2 - 8);
    const z = (Math.random() - 0.5) * (H * 2 - 8);
    // skip the road/compound/spawn area so it doesn't visually clutter lanes
    if (Math.abs(x) < 4 && z > -6 && z < 20) continue;
    buildBush(x, z, 0.8 + Math.random() * 0.9);
  }
})();
bushMat.color.set(THEMES[currentThemeKey].grass);

// Ruined structures — broken watchtowers + wall segments, for verticality and cover.
// Reuses the same addCollider/envMeshes pattern as crates and rocks (no new systems).
function buildStoneTexture(baseHex, mortarHex) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = mortarHex; ctx.lineWidth = 3;
  const rows = 8, rowH = size / rows;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rowH); ctx.lineTo(size, r * rowH); ctx.stroke(); }
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 20;
    for (let x = -20 + offset; x < size; x += 40) { ctx.beginPath(); ctx.moveTo(x, r * rowH); ctx.lineTo(x, (r + 1) * rowH); ctx.stroke(); }
  }
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}
const ruinMat = new THREE.MeshStandardMaterial({ map: buildStoneTexture(THEMES.dustline.crate1.base, THEMES.dustline.crate1.band), roughness: 0.95 });

const rebarMat = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.75, metalness: 0.5 });
// jagged broken-top chunks + exposed rebar + a small rubble pile — shared by tower/wall ruins
function addDamageDetail(x, z, topY, spanRadius) {
  const chunkCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chunkCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spanRadius * (0.3 + Math.random() * 0.7);
    const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
    const s = 0.3 + Math.random() * 0.35;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s), ruinMat);
    chunk.position.set(cx, topY + s * 0.2, cz);
    chunk.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    chunk.castShadow = true; chunk.receiveShadow = true;
    chunk.userData.type = 'env'; chunk.userData.surface = 'metal';
    scene.add(chunk); envMeshes.push(chunk);
  }
  const rebarCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < rebarCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spanRadius * (0.2 + Math.random() * 0.7);
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7 + Math.random() * 0.5, 4), rebarMat);
    rb.position.set(x + Math.cos(a) * r, topY + 0.25, z + Math.sin(a) * r);
    rb.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
    scene.add(rb); // decorative only — thin enough that skipping raycast/collision is unnoticeable
  }
  const rubbleCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < rubbleCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spanRadius + 0.6 + Math.random() * 1.2;
    const s = 0.25 + Math.random() * 0.35;
    const rub = new THREE.Mesh(tintGeometryFaces(new THREE.IcosahedronGeometry(s, 0), 0x6b5642, 0.5), rockMat);
    rub.position.set(x + Math.cos(a) * r, s * 0.4, z + Math.sin(a) * r);
    rub.rotation.set(Math.random(), Math.random(), Math.random());
    rub.castShadow = true; rub.receiveShadow = true;
    scene.add(rub); // decorative only, small enough not to need its own collider
  }
}
function buildTower(x, z, radius, height) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.15, height, 8, 1, true);
  const m = new THREE.Mesh(geo, ruinMat);
  m.position.set(x, height / 2, z);
  m.rotation.y = Math.random() * Math.PI;
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'metal';
  scene.add(m); envMeshes.push(m);
  addCollider(x - radius, z - radius, x + radius, z + radius);
  addDamageDetail(x, z, height, radius);
}
function buildWallRuin(x, z, w, h, rotY) {
  const geo = new THREE.BoxGeometry(w, h, 0.6);
  const m = new THREE.Mesh(geo, ruinMat);
  m.position.set(x, h / 2, z);
  m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'metal';
  scene.add(m); envMeshes.push(m);
  const hw = Math.abs(Math.cos(rotY)) * w / 2 + 0.4, hd = Math.abs(Math.sin(rotY)) * w / 2 + 0.4;
  addCollider(x - hw, z - hd, x + hw, z + hd);
  addDamageDetail(x, z, h, w / 2.2);
}
buildTower(-24, -22, 2.4, 8.5);
buildTower(20, 24, 2.6, 7.5);
buildTower(-2, -28, 2.2, 6.5);
buildWallRuin(14, -8, 6, 3.2, 0.4);
buildWallRuin(-16, 12, 5, 2.6, 1.1);

// Small props — barrels, pipes, a sign — for environmental detail. Same collider pattern as crates.
const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6a5030, roughness: 0.6, metalness: 0.3 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x565f63, roughness: 0.45, metalness: 0.6 });
const signMat = new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 0.7, metalness: 0.2 });
function buildBarrel(x, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 10), barrelMat);
  m.position.set(x, 0.5, z);
  m.rotation.y = Math.random() * Math.PI;
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'metal';
  scene.add(m); envMeshes.push(m);
  addCollider(x - 0.42, z - 0.42, x + 0.42, z + 0.42);
}
function buildPipe(x, z, len, rotY) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 8), pipeMat);
  m.position.set(x, 0.16, z);
  m.rotation.z = Math.PI / 2;
  m.rotation.y = rotY;
  m.castShadow = true; m.receiveShadow = true;
  m.userData.type = 'env'; m.userData.surface = 'metal';
  scene.add(m); envMeshes.push(m);
  const hw = Math.abs(Math.cos(rotY)) * len / 2 + 0.2, hd = Math.abs(Math.sin(rotY)) * len / 2 + 0.2;
  addCollider(x - hw, z - hd, x + hw, z + hd);
}
function buildSign(x, z, rotY) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), pipeMat);
  post.position.set(x, 0.9, z);
  post.castShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.06), signMat);
  board.position.set(x, 1.65, z);
  board.rotation.y = rotY;
  board.castShadow = true; board.receiveShadow = true;
  board.userData.type = 'env'; board.userData.surface = 'wood';
  scene.add(post, board); envMeshes.push(board);
  addCollider(x - 0.1, z - 0.1, x + 0.1, z + 0.1);
}
buildBarrel(8, -6); buildBarrel(8.7, -5.3); buildBarrel(-18, -6);
buildBarrel(19, 2); buildBarrel(-6, 18);
buildPipe(2, 6, 3.2, 0.3);
buildPipe(-9, -18, 2.6, 1.0);
buildSign(6, -14, 0.6);
buildSign(-18, 6, 2.1);

// Elevated sniper perch — visual ramp + platform matching the PERCH ground-height zone above.
// No new collider needed for walking on top (height comes from getGroundHeight), but the
// platform edges get thin rail colliders so players can't casually step off the side unnoticed.
{
  const rampCx = (PERCH.xMin + PERCH.xMax) / 2;
  const rampCz = (PERCH.rampZTop + PERCH.rampZBottom) / 2;
  const rampDepth = PERCH.rampZTop - PERCH.rampZBottom;
  const rampLen = Math.sqrt(rampDepth * rampDepth + PERCH.height * PERCH.height);
  const rampAngle = Math.atan2(PERCH.height, rampDepth);
  const rampW = PERCH.xMax - PERCH.xMin;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampW, 0.5, rampLen), ruinMat);
  ramp.position.set(rampCx, PERCH.height / 2, rampCz);
  ramp.rotation.x = rampAngle;
  ramp.castShadow = true; ramp.receiveShadow = true;
  ramp.userData.type = 'env'; ramp.userData.surface = 'metal';
  scene.add(ramp); envMeshes.push(ramp);

  const platCz = (PERCH.platZMin + PERCH.platZMax) / 2;
  const platDepth = PERCH.platZMax - PERCH.platZMin;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(rampW, 0.5, platDepth), ruinMat);
  platform.position.set(rampCx, PERCH.height - 0.25, platCz);
  platform.castShadow = true; platform.receiveShadow = true;
  platform.userData.type = 'env'; platform.userData.surface = 'metal';
  scene.add(platform); envMeshes.push(platform);

  // low guard rails along the platform's outer (south/east) edges — thin, collidable
  const railMat = ruinMat;
  const railBack = new THREE.Mesh(new THREE.BoxGeometry(rampW, 0.7, 0.25), railMat);
  railBack.position.set(rampCx, PERCH.height + 0.35, PERCH.platZMin + 0.15);
  railBack.castShadow = true; railBack.userData.type = 'env'; railBack.userData.surface = 'metal';
  scene.add(railBack); envMeshes.push(railBack);
  addCollider(rampCx - rampW / 2, PERCH.platZMin - 0.2, rampCx + rampW / 2, PERCH.platZMin + 0.4);

  const railSide = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, platDepth), railMat);
  railSide.position.set(PERCH.xMax - 0.15, PERCH.height + 0.35, platCz);
  railSide.castShadow = true; railSide.userData.type = 'env'; railSide.userData.surface = 'metal';
  scene.add(railSide); envMeshes.push(railSide);
  addCollider(PERCH.xMax - 0.4, PERCH.platZMin, PERCH.xMax + 0.2, PERCH.platZMax);

  // Fill the sides of the ramp itself (not just the platform) — getGroundHeight()
  // reports the elevated ramp/platform height for ANY x/z inside this footprint
  // regardless of the player's actual height, and this collision system is
  // height-blind (a 2D x/z push-out, see resolveCircleVsBoxes), so walking into
  // the footprint from the side at ground level snapped players straight up onto
  // the ramp ("teleporting" onto it). The only collision-free way in stays the
  // intended front face at z = PERCH.rampZTop, where the ramp height is already 0.
  addCollider(PERCH.xMin - 0.3, PERCH.platZMin, PERCH.xMin + 0.3, PERCH.rampZTop); // west side, full depth
  addCollider(PERCH.xMax - 0.3, PERCH.platZMin, PERCH.xMax + 0.3, PERCH.rampZTop); // east ("right") side, full depth

  // cover crates on the perch itself — gives the sniper spot something to post up behind
  [[-1.2, 0], [1.6, -1.4]].forEach(([ox, oz], i) => {
    const s = 1.8;
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), i % 2 === 0 ? crateMat1 : crateMat2);
    c.position.set(rampCx + ox, PERCH.height + s / 2, platCz + oz);
    c.castShadow = true; c.receiveShadow = true;
    c.userData.type = 'env'; c.userData.surface = 'wood';
    scene.add(c); envMeshes.push(c);
  });
}

// Ruined military compound — clusters new detail around the existing tower at (-24,-22)
// so it reads as one designed area instead of scattered props.
const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.95 });
function buildSandbagLine(x, z, len, rotY) {
  const count = Math.max(2, Math.round(len / 0.8));
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * 0.8;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.42), sandbagMat);
    s.position.set(x + Math.sin(rotY) * t, 0.21, z + Math.cos(rotY) * t);
    s.rotation.y = rotY + (Math.random() - 0.5) * 0.15;
    s.castShadow = true; s.receiveShadow = true;
    s.userData.type = 'env'; s.userData.surface = 'wood';
    scene.add(s); envMeshes.push(s);
  }
  const hx = Math.abs(Math.cos(rotY)) * (len / 2) + 0.3, hz = Math.abs(Math.sin(rotY)) * (len / 2) + 0.3;
  addCollider(x - hx, z - hz, x + hx, z + hz);
}
buildSandbagLine(-19, -19, 4.5, 0.9);
buildSandbagLine(-27, -16, 4, 0.15);

// Real sourced environment props (shipping container, concrete barrier,
// stacked sandbag wall) layered in alongside the procedural geometry above,
// using the same fetch + THREE.GLTFLoader().parse() pattern already proven
// for the real gun models. Loads each source file once, then clones it per
// placement instance so the network/parse cost is paid only once no matter
// how many times a prop is placed. Pushes the actual meshes (not a wrapper
// Group) into envMeshes/collidables — intersectObjects() is called with
// recursive:false everywhere in this file (see tryShoot/losRaycaster), so a
// childless Group would be invisible to both bullet hits and bot LOS checks.
function loadRealEnvProp(url, instances, opts) {
  opts = opts || {};
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve();
  return fetch(url)
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
    .then((buffer) => new Promise((resolve, reject) => {
      new THREE.GLTFLoader().parse(buffer, '', resolve, reject);
    }))
    .then((gltf) => {
      const template = gltf.scene;
      // Center the template on its own footprint (X/Z) and rest it on
      // Y=0 (its lowest point) — these exports come in at an arbitrary
      // real-world origin/scale, not centered/grounded for drop-in use.
      const box = new THREE.Box3().setFromObject(template);
      const center = box.getCenter(new THREE.Vector3());
      const rawSize = box.getSize(new THREE.Vector3());
      template.position.x -= center.x;
      template.position.z -= center.z;
      template.position.y -= box.min.y;
      instances.forEach((inst) => {
        const clone = template.clone(true);
        const wrapper = new THREE.Group();
        wrapper.add(clone);
        const scale = inst.scale || opts.scale || 1;
        wrapper.scale.setScalar(scale);
        wrapper.position.set(inst.x, 0, inst.z);
        wrapper.rotation.y = inst.ry || 0;
        scene.add(wrapper);
        wrapper.updateMatrixWorld(true);
        clone.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            child.userData.type = 'env';
            child.userData.surface = opts.surface || 'metal';
            envMeshes.push(child);
          }
        });
        // Rotation-aware 2D collider half-extents (same math as buildWallRuin).
        // Width/depth come from the template's own measured bounding box
        // (rawSize, in the model's raw/unscaled units) times this instance's
        // scale — NOT from a manually-estimated opts.colliderW/colliderD,
        // which was tried first and silently produced a near-zero collider
        // (a hand-measured real-world size getting scaled down a second
        // time here), letting the player walk straight through.
        // Skippable: the sandbag wall model is layered visually on top of the
        // existing buildSandbagLine() bags, which already own a collider at
        // the same spot — adding a second one here would just double it up.
        if (!opts.skipCollider) {
          const w = rawSize.x * scale;
          const d = rawSize.z * scale;
          const rotY = inst.ry || 0;
          const pad = opts.pad != null ? opts.pad : 0.2;
          const hw = Math.abs(Math.cos(rotY)) * w / 2 + Math.abs(Math.sin(rotY)) * d / 2 + pad;
          const hd = Math.abs(Math.sin(rotY)) * w / 2 + Math.abs(Math.cos(rotY)) * d / 2 + pad;
          addCollider(inst.x - hw, inst.z - hd, inst.x + hw, inst.z + hd);
        }
      });
    })
    .catch((err) => {
      console.error('Env prop: failed to load ' + url + ', skipping (procedural geometry stays as-is).', err);
    });
}

// Swaps the real Poly Haven boulder model in for the hand-placed procedural
// rocks registered in rockRegistry[0..cutoff) — the deliberately positioned
// ones the player actually walks past, not the random far-edge dressing.
// Each swap removes that rock's old procedural mesh + chip meshes (scene
// and envMeshes both) and clones the real boulder in at the same x/z, sized
// to roughly match the footprint the procedural version would have had, so
// collision (already registered by buildRock) still lines up.
function loadRealBoulders(url, cutoff) {
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve();
  return fetch(url)
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
    .then((buffer) => new Promise((resolve, reject) => {
      new THREE.GLTFLoader().parse(buffer, '', resolve, reject);
    }))
    .then((gltf) => {
      const template = gltf.scene;
      const box = new THREE.Box3().setFromObject(template);
      const center = box.getCenter(new THREE.Vector3());
      const rawSize = box.getSize(new THREE.Vector3());
      template.position.x -= center.x;
      template.position.z -= center.z;
      template.position.y -= box.min.y;
      const maxHorizontal = Math.max(rawSize.x, rawSize.z);

      rockRegistry.slice(0, cutoff).forEach((rock) => {
        scene.remove(rock.mesh);
        let idx = envMeshes.indexOf(rock.mesh);
        if (idx !== -1) envMeshes.splice(idx, 1);
        rock.chips.forEach((chip) => {
          scene.remove(chip);
          idx = envMeshes.indexOf(chip);
          if (idx !== -1) envMeshes.splice(idx, 1);
        });

        const clone = template.clone(true);
        const wrapper = new THREE.Group();
        wrapper.add(clone);
        // Matches buildRock's own sizing: a rock called with radius s reads
        // as roughly 2*s wide, so scale the real model's own horizontal
        // footprint to land on the same width.
        const scale = (rock.s * 2) / maxHorizontal;
        wrapper.scale.setScalar(scale);
        wrapper.position.set(rock.x, 0, rock.z);
        wrapper.rotation.y = Math.random() * Math.PI * 2;
        scene.add(wrapper);
        clone.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            child.userData.type = 'env';
            child.userData.surface = 'rock';
            envMeshes.push(child);
          }
        });
        // No addCollider() here — buildRock() already registered this
        // rock's collider (x ± s*.8) when it first created the procedural
        // version; the real model is a same-spot visual swap only.
      });
    })
    .catch((err) => {
      console.error('Real boulders: failed to load ' + url + ', keeping procedural rocks.', err);
    });
}

// damaged vehicle wreck — simple boxy chassis + cylinder wheels, tilted for a "knocked out" look
{
  const wreckMat = new THREE.MeshStandardMaterial({ color: 0x3a3f38, roughness: 0.85, metalness: 0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18150f, roughness: 0.9 });
  const wreck = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.4), wreckMat);
  chassis.position.y = 0.55;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.4), wreckMat);
  cab.position.set(0, 1.05, -0.6);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8);
  [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.1], [0.9, -1.1]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wreck.add(wheel);
  });
  wreck.add(chassis, cab);
  wreck.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  wreck.position.set(-22, 0, -25);
  wreck.rotation.set(0, 0.5, 0.12); // slumped, off-kilter — reads as wrecked rather than parked
  wreck.userData.type = 'env'; wreck.userData.surface = 'metal';
  scene.add(wreck); envMeshes.push(wreck);
  addCollider(-24, -27, -20, -23);
}

// short fence line marking the compound edge — instanced posts (one draw call) + a
// chain-link-pattern alpha plane for the wire mesh
const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x4a4f4a, roughness: 0.6, metalness: 0.5 });
const FENCE_POST_COUNT = 8;
const fencePosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), fencePostMat, FENCE_POST_COUNT);
fencePosts.castShadow = true;
{
  const dummy = new THREE.Object3D();
  const fx0 = -30, fz0 = -28, fx1 = -30, fz1 = -14; // fence runs along x=-30, from z=-28 to z=-14
  for (let i = 0; i < FENCE_POST_COUNT; i++) {
    const t = i / (FENCE_POST_COUNT - 1);
    dummy.position.set(fx0 + (fx1 - fx0) * t, 0.7, fz0 + (fz1 - fz0) * t);
    dummy.updateMatrix();
    fencePosts.setMatrixAt(i, dummy.matrix);
  }
  fencePosts.instanceMatrix.needsUpdate = true;
}
scene.add(fencePosts);
addCollider(-30.3, -28, -29.7, -14);

const chainCanvas = document.createElement('canvas');
chainCanvas.width = chainCanvas.height = 64;
{
  const cctx = chainCanvas.getContext('2d');
  cctx.strokeStyle = '#cfd4d0'; cctx.lineWidth = 1.4; cctx.globalAlpha = 0.8;
  for (let i = -8; i <= 8; i++) {
    cctx.beginPath(); cctx.moveTo(i * 8, 0); cctx.lineTo(i * 8 + 64, 64); cctx.stroke();
    cctx.beginPath(); cctx.moveTo(i * 8, 64); cctx.lineTo(i * 8 + 64, 0); cctx.stroke();
  }
}
const chainTex = new THREE.CanvasTexture(chainCanvas);
chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;
chainTex.repeat.set(6, 1);
const fenceWireMat = new THREE.MeshStandardMaterial({
  map: chainTex, alphaMap: chainTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: 0x9aa09a, roughness: 0.7,
});
const fenceWire = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), fenceWireMat);
fenceWire.rotation.y = Math.PI / 2;
fenceWire.position.set(-30, 0.7, -21);
scene.add(fenceWire);
// Gives the map a sense of scale/horizon without per-object cost.
const mountainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: true });
const MOUNTAIN_COUNT = 34;
const mountainMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mountainMat, MOUNTAIN_COUNT);
mountainMesh.castShadow = false; mountainMesh.receiveShadow = false;
{
  const dummy = new THREE.Object3D();
  const ringRadius = CFG.arenaHalf + 45;
  for (let i = 0; i < MOUNTAIN_COUNT; i++) {
    const angle = (i / MOUNTAIN_COUNT) * Math.PI * 2 + Math.random() * 0.15;
    // depth 0..1: closer instances read as midground foothills, farther ones as
    // background peaks — size/height correlate with distance for a believable range
    const depth = Math.random();
    const radius = ringRadius + depth * 55 + (Math.random() - 0.5) * 10;
    const height = 22 + depth * 95;
    const baseR = 14 + depth * 30;
    dummy.position.set(Math.cos(angle) * radius, height * 0.5 - 4, Math.sin(angle) * radius);
    dummy.scale.set(baseR, height, baseR);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    mountainMesh.setMatrixAt(i, dummy.matrix);
  }
  mountainMesh.instanceMatrix.needsUpdate = true;
}
scene.add(mountainMesh);

// Secondary canyon ridge: offset, irregular rock spires behind the first ridge
// add depth parallax to the skyline. Instanced, non-colliding, and shadowless.
const farRidgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: true });
const FAR_RIDGE_COUNT = 46;
const farRidge = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), farRidgeMat, FAR_RIDGE_COUNT);
farRidge.castShadow = false; farRidge.receiveShadow = false;
{
  const d = new THREE.Object3D();
  for (let i = 0; i < FAR_RIDGE_COUNT; i++) {
    const a = (i / FAR_RIDGE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const r = 112 + Math.random() * 34;
    const h = 34 + Math.random() * 76;
    const w = 18 + Math.random() * 28;
    d.position.set(Math.cos(a) * r, h * 0.48 - 8, Math.sin(a) * r);
    d.scale.set(w, h, w * (0.65 + Math.random() * 0.7));
    d.rotation.set((Math.random() - 0.5) * 0.08, Math.random() * Math.PI, (Math.random() - 0.5) * 0.08);
    d.updateMatrix();
    farRidge.setMatrixAt(i, d.matrix);
    const shade = 0.68 + Math.random() * 0.34;
    farRidge.setColorAt(i, new THREE.Color(0x776451).multiplyScalar(shade));
  }
  farRidge.instanceMatrix.needsUpdate = true;
  if (farRidge.instanceColor) farRidge.instanceColor.needsUpdate = true;
}
scene.add(farRidge);

// Environment dressing pass: scattered angular shale, broken rock plates and dry
// scrub tufts. All are instanced in a few draw calls, deliberately non-colliding,
// and avoid the central spawn lane and existing cover footprints.
const shaleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, flatShading: true });
const shaleGeo = new THREE.DodecahedronGeometry(1, 0);
const SHALE_COUNT = isTouch ? 170 : 290;
const shaleInst = new THREE.InstancedMesh(shaleGeo, shaleMat, SHALE_COUNT);
shaleInst.castShadow = false; shaleInst.receiveShadow = true;
const scrubMat = new THREE.MeshStandardMaterial({ color: 0x8a7547, roughness: 1, side: THREE.DoubleSide, transparent: true, alphaTest: 0.35, depthWrite: true });
const scrubGeo = new THREE.BufferGeometry();
scrubGeo.setAttribute('position', new THREE.Float32BufferAttribute([
  -0.16,0,0, 0.02,0.62,0, 0.02,0,0,
   0.00,0,0, 0.20,0.48,0, 0.02,0,0,
  -0.03,0,0, -0.22,0.40,0, 0.02,0,0
], 3));
scrubGeo.setIndex([0,1,2, 3,4,5, 6,7,8]);
scrubGeo.computeVertexNormals();
const SCRUB_COUNT = isTouch ? 70 : 125;
const scrubA = new THREE.InstancedMesh(scrubGeo, scrubMat, SCRUB_COUNT);
const scrubB = new THREE.InstancedMesh(scrubGeo, scrubMat, SCRUB_COUNT);
scrubA.castShadow = false; scrubB.castShadow = false;
{
  const d = new THREE.Object3D();
  let rockN = 0, scrubN = 0, attempts = 0;
  while ((rockN < SHALE_COUNT || scrubN < SCRUB_COUNT) && attempts < SHALE_COUNT * 12) {
    attempts++;
    const x = (Math.random() - 0.5) * (CFG.arenaHalf * 2 - 3);
    const z = (Math.random() - 0.5) * (CFG.arenaHalf * 2 - 3);
    if (Math.hypot(x, z - 6) < 5 || (Math.abs(x) < 4.5 && z > -26 && z < 20)) continue;
    let blocked = false;
    for (const box of collidables) {
      if (box.map && box.map !== activeMapKey) continue;
      if (x > box.min.x - 0.75 && x < box.max.x + 0.75 && z > box.min.z - 0.75 && z < box.max.z + 0.75) { blocked = true; break; }
    }
    if (blocked) continue;
    const groundY = Math.max(-0.05, terrainNoise(x, z) * 0.22);
    if (rockN < SHALE_COUNT && Math.random() < 0.68) {
      const sx = 0.12 + Math.random() * 0.42;
      d.position.set(x, groundY + sx * 0.22, z);
      d.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.25);
      d.scale.set(sx * (0.8 + Math.random()), sx * (0.25 + Math.random() * 0.38), sx * (0.7 + Math.random() * 1.3));
      d.updateMatrix(); shaleInst.setMatrixAt(rockN, d.matrix);
      const tint = new THREE.Color().setHSL(0.09 + Math.random() * 0.05, 0.13 + Math.random() * 0.12, 0.28 + Math.random() * 0.24);
      shaleInst.setColorAt(rockN, tint); rockN++;
    } else if (scrubN < SCRUB_COUNT) {
      const sc = 0.45 + Math.random() * 0.85;
      d.position.set(x, groundY, z);
      d.rotation.set(0, Math.random() * Math.PI, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix(); scrubA.setMatrixAt(scrubN, d.matrix);
      d.rotation.y += Math.PI * 0.5; d.updateMatrix(); scrubB.setMatrixAt(scrubN, d.matrix);
      scrubN++;
    }
  }
  shaleInst.count = rockN; scrubA.count = scrubN; scrubB.count = scrubN;
  shaleInst.instanceMatrix.needsUpdate = true;
  scrubA.instanceMatrix.needsUpdate = true; scrubB.instanceMatrix.needsUpdate = true;
  if (shaleInst.instanceColor) shaleInst.instanceColor.needsUpdate = true;
}
scene.add(shaleInst, scrubA, scrubB);

// Ground clutter: pebbles + dry grass tufts, purely decorative (no collision).
// Built as two InstancedMesh batches (one draw call each) so coverage can scale
// up with the larger arena without adding per-object cost.
const pebbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x8a7a3f, roughness: 1, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, fog: true });

const grassCanvas = document.createElement('canvas');
grassCanvas.width = 32; grassCanvas.height = 32;
const gctx2 = grassCanvas.getContext('2d');
gctx2.strokeStyle = '#9c8a4a'; gctx2.lineWidth = 2;
for (let i = 0; i < 5; i++) {
  const x = 4 + i * 5 + Math.random() * 2;
  gctx2.beginPath(); gctx2.moveTo(x, 32); gctx2.quadraticCurveTo(x + (Math.random() - 0.5) * 6, 14, x + (Math.random() - 0.5) * 4, 2);
  gctx2.stroke();
}
const grassTex = new THREE.CanvasTexture(grassCanvas);
grassMat.map = grassTex;
grassMat.alphaMap = grassTex;

const CLUTTER_COUNT = isTouch ? 260 : 420;
const pebbleGeo = new THREE.IcosahedronGeometry(0.16, 0);
const grassGeo = new THREE.PlaneGeometry(0.6, 0.6);
const pebbleInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, CLUTTER_COUNT);
const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, CLUTTER_COUNT * 2);
pebbleInst.receiveShadow = true;
let pebbleN = 0, grassN = 0;
const dummyClutter = new THREE.Object3D();
for (let i = 0; i < CLUTTER_COUNT * 2; i++) {
  const x = (Math.random() - 0.5) * (CFG.arenaHalf * 2 - 3);
  const z = (Math.random() - 0.5) * (CFG.arenaHalf * 2 - 3);
  // skip if too close to spawn or overlapping a collider (loose check)
  let blocked = false;
  for (const box of collidables) { if (box.map && box.map !== activeMapKey) continue; if (x > box.min.x - 1 && x < box.max.x + 1 && z > box.min.z - 1 && z < box.max.z + 1) { blocked = true; break; } }
  if (blocked || Math.hypot(x, z - 6) < 3) continue;

  if (i % 3 === 0 && pebbleN < CLUTTER_COUNT) {
    const s = 0.7 + Math.random() * 1.4;
    dummyClutter.position.set(x, 0.06 * s, z);
    dummyClutter.rotation.set(0, Math.random() * Math.PI, 0);
    dummyClutter.scale.set(s, s, s);
    dummyClutter.updateMatrix();
    pebbleInst.setMatrixAt(pebbleN++, dummyClutter.matrix);
  } else if (grassN < CLUTTER_COUNT * 2) {
    const s = 0.8 + Math.random() * 0.5;
    dummyClutter.position.set(x, 0.3 * s, z);
    dummyClutter.rotation.set(0, Math.random() * Math.PI, 0);
    dummyClutter.scale.set(s, s, s);
    dummyClutter.updateMatrix();
    grassInst.setMatrixAt(grassN++, dummyClutter.matrix);
  }
}
pebbleInst.count = pebbleN;
grassInst.count = grassN;
pebbleInst.instanceMatrix.needsUpdate = true;
grassInst.instanceMatrix.needsUpdate = true;
scene.add(pebbleInst, grassInst);

/* ============================================================
   THEME APPLICATION — retints shared geometry, no rebuilds needed
   ============================================================ */
function applyTheme(key) {
  const theme = THEMES[key];
  if (!theme) return;
  currentThemeKey = key;

  // sky + fog
  skyMat.uniforms.top.value.set(theme.sky.top);
  skyMat.uniforms.mid.value.set(theme.sky.mid);
  skyMat.uniforms.bottom.value.set(theme.sky.bottom);
  sunDiscMesh.material.color.set(theme.sun.disc);
  scene.fog.color.set(theme.fog.color);
  hazeMat.color.set(theme.fog.color);
  scene.fog.density = theme.fog.density;

  // lighting
  hemi.color.set(theme.hemi.sky);
  hemi.groundColor.set(theme.hemi.ground);
  hemi.intensity = theme.hemiIntensity;
  sun.color.set(theme.sun.light);
  sun.intensity = theme.sunIntensity;
  fillLight.color.set(theme.fill);
  rimLight.color.set(theme.sun.disc);
  renderer.toneMappingExposure = theme.exposure;

  // floor
  const newSand = buildSandTexture(theme);
  const newTex = new THREE.CanvasTexture(newSand);
  newTex.wrapS = newTex.wrapT = THREE.RepeatWrapping;
  newTex.repeat.set(9, 9);
  newTex.anisotropy = 8;
  newTex.encoding = THREE.sRGBEncoding;
  if (floorMat.map) floorMat.map.dispose();
  floorMat.map = newTex;
  floorMat.needsUpdate = true;

  // walls
  wallMat.color.set(theme.wall);

  // crates
  const c1 = buildCrateTexture(theme.crate1.base, theme.crate1.band);
  const c2 = buildCrateTexture(theme.crate2.base, theme.crate2.band);
  if (crateMat1.map) crateMat1.map.dispose();
  if (crateMat2.map) crateMat2.map.dispose();
  crateMat1.map = c1; crateMat1.needsUpdate = true;
  crateMat2.map = c2; crateMat2.needsUpdate = true;

  // ruined structures
  const stoneTex = buildStoneTexture(theme.crate1.base, theme.crate1.band);
  if (ruinMat.map) ruinMat.map.dispose();
  ruinMat.map = stoneTex; ruinMat.needsUpdate = true;

  // rocks (individual, baked vertex-color variation tinted via material.color)
  rockMat.color.set(theme.rockTint);
  // pebbles + grass (instanced ground clutter, flat material.color tint)
  pebbleMat.color.set(theme.rockTint);
  grassMat.color.set(theme.grass);
  bushMat.color.set(theme.grass);

  // distant mountain ring
  mountainMat.color.set(theme.rockTint);
  farRidgeMat.color.set(theme.rockTint).multiplyScalar(0.78);
  shaleMat.color.set(theme.rockTint);
  scrubMat.color.set(theme.grass);
}
applyTheme(currentThemeKey);

/* Map select UI (mission briefing screen) */
const THEME_BLURBS = {
  dustline: 'Sun-scorched canyon ridgelines and crumbling supply outposts.',
  frostbound: 'Frozen ravines, whiteout wind and razor-thin visibility.',
  nightshade: 'Neon-lit ruins under a bleeding violet sky.',
};
const themeSwatchesEl = document.getElementById('theme-swatches');
const briefingEnvEl = document.getElementById('briefing-env');
Object.keys(THEMES).forEach((key) => {
  const theme = THEMES[key];
  const card = document.createElement('div');
  card.className = 'map-card' + (key === currentThemeKey ? ' selected' : '');
  card.dataset.theme = key;
  card.innerHTML = `
    <div class="map-card-preview" style="background:linear-gradient(160deg, ${theme.swatch[0]}, ${theme.swatch[1]}, ${theme.swatch[2]});">
      <div class="map-card-tag">Active</div>
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${theme.name}</div>
      <div class="map-card-blurb">${THEME_BLURBS[key] || ''}</div>
    </div>
  `;
  card.addEventListener('click', () => {
    document.querySelectorAll('.map-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    applyTheme(key);
    if (briefingEnvEl) briefingEnvEl.textContent = theme.name;
  });
  themeSwatchesEl.appendChild(card);
});
if (briefingEnvEl) briefingEnvEl.textContent = THEMES[currentThemeKey].name;

/* ============================================================
   COLLISION HELPERS
   ============================================================ */
function resolveCircleVsBoxes(pos, radius, ignoreList) {
  for (const box of collidables) {
    if (box.map && box.map !== activeMapKey) continue;
    const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    let dx = pos.x - cx, dz = pos.z - cz;
    let dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < radius) {
      if (dist === 0) { dx = 1; dz = 0; dist = 0.001; }
      const push = (radius - dist);
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
  const limit = CFG.arenaHalf - 0.6;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

/* ============================================================
   INPUT MANAGER — unified desktop + mobile
   ============================================================ */
const Input = {
  move: { x: 0, z: 0 },
  yawDelta: 0,
  pitchDelta: 0,
  shootHeld: false,
  jumpQueued: false,
  reloadQueued: false,
  adsHeld: false,
  sprintHeld: false,
  locked: false,
  paused: false,
};

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') Input.jumpQueued = true;
  if (e.code === 'KeyR') Input.reloadQueued = true;
  if (e.code === 'Digit1') switchWeapon('assault');
  if (e.code === 'Digit2') switchWeapon('shotgun');
  if (e.code === 'Digit3') switchWeapon('sniper');
  if (e.code === 'Digit4') switchWeapon('smg');
  if (e.code === 'Digit5') switchWeapon('lmg');
  if (e.code === 'Escape') { if (Input.paused) resumeGame(); else openPauseMenu(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function updateKeyboardMove() {
  let x = 0, z = 0;
  if (keys['KeyW']) z += 1;
  if (keys['KeyS']) z -= 1;
  if (keys['KeyA']) x -= 1;
  if (keys['KeyD']) x += 1;
  const len = Math.hypot(x, z);
  if (len > 0) { x /= len; z /= len; }
  Input.move.x = x; Input.move.z = z;
  Input.sprintHeld = !!(keys['ShiftLeft'] || keys['ShiftRight']);
}

// Desktop mouse look — pointer lock captures and hides the cursor so the
// player can spin freely without running out of screen space. Losing lock
// (Escape, alt-tab, etc.) opens the pause menu.
const canvasEl = renderer.domElement;
canvasEl.addEventListener('click', () => {
  resumeAudio();
  if (!isTouch && Input.gameActive && !Input.paused) canvasEl.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  Input.locked = document.pointerLockElement === canvasEl;
  if (!Input.locked && Input.gameActive) openPauseMenu();
});
window.addEventListener('mousemove', (e) => {
  if (!Input.locked) return;
  Input.yawDelta -= e.movementX * CFG.mouseSens * save.sensitivity;
  Input.pitchDelta -= e.movementY * CFG.mouseSens * save.sensitivity;
});
window.addEventListener('mousedown', (e) => {
  if (!Input.locked) return;
  if (e.button === 0) Input.shootHeld = true;
  if (e.button === 2) Input.adsHeld = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) Input.shootHeld = false;
  if (e.button === 2) Input.adsHeld = false;
});
window.addEventListener('contextmenu', (e) => { if (!isTouch) e.preventDefault(); });

// Mobile: joystick
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyStick = document.getElementById('joy-stick');
let joyTouchId = null, joyOrigin = { x: 0, y: 0 };
const JOY_RADIUS = 55;

joyZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  joyTouchId = t.identifier;
  joyOrigin = { x: t.clientX, y: t.clientY };
  joyBase.style.display = 'block';
  joyBase.style.left = (t.clientX - 55) + 'px';
  joyBase.style.top = (t.clientY - 55) + 'px';
  joyStick.style.left = '31px'; joyStick.style.top = '31px';
}, { passive: true });

joyZone.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joyTouchId) continue;
    let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) { dx = dx / dist * JOY_RADIUS; dy = dy / dist * JOY_RADIUS; }
    joyStick.style.left = (31 + dx) + 'px';
    joyStick.style.top = (31 + dy) + 'px';
    Input.move.x = Math.max(-1, Math.min(1, dx / JOY_RADIUS));
    Input.move.z = Math.max(-1, Math.min(1, -dy / JOY_RADIUS));
  }
}, { passive: true });

function endJoy(e) {
  for (const t of e.changedTouches) {
    if (t.identifier !== joyTouchId) continue;
    joyTouchId = null;
    joyBase.style.display = 'none';
    Input.move.x = 0; Input.move.z = 0;
  }
}
joyZone.addEventListener('touchend', endJoy);
joyZone.addEventListener('touchcancel', endJoy);

// Mobile: look zone (drag anywhere on right side)
const lookZone = document.getElementById('look-zone');
let lookTouchId = null, lastLook = { x: 0, y: 0 };
lookZone.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  lookTouchId = t.identifier;
  lastLook = { x: t.clientX, y: t.clientY };
}, { passive: true });
lookZone.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== lookTouchId) continue;
    const dx = t.clientX - lastLook.x, dy = t.clientY - lastLook.y;
    lastLook = { x: t.clientX, y: t.clientY };
    Input.yawDelta -= dx * CFG.touchLookSens * save.sensitivity;
    Input.pitchDelta -= dy * CFG.touchLookSens * save.sensitivity;
  }
}, { passive: true });
lookZone.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
});

// Mobile buttons
const btnShoot = document.getElementById('btn-shoot');
const btnJump = document.getElementById('btn-jump');
const btnReload = document.getElementById('btn-reload');
const btnWeapon = document.getElementById('btn-weapon');
const weaponCycle = ['assault', 'smg', 'shotgun', 'sniper', 'lmg'];
btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); Input.shootHeld = true; }, { passive: false });
btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); Input.shootHeld = false; }, { passive: false });
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); Input.jumpQueued = true; }, { passive: false });
btnReload.addEventListener('touchstart', (e) => { e.preventDefault(); Input.reloadQueued = true; }, { passive: false });
btnWeapon.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const idx = weaponCycle.indexOf(currentWeaponKey);
  switchWeapon(weaponCycle[(idx + 1) % weaponCycle.length]);
}, { passive: false });

if (isTouch) {
  document.getElementById('desktop-legend').classList.add('hidden');
}

/* ============================================================
   PLAYER
   ============================================================ */
const yawObject = new THREE.Object3D();
const pitchObject = new THREE.Object3D();
pitchObject.add(camera);
yawObject.add(pitchObject);
scene.add(yawObject);

// viewmodel guns — shared materials (metal + polymer), three primitive-built models
// as children of the same gunGroup container (so existing sway/recoil/bob code needs no changes)
const gunGroup = new THREE.Group();
const gunMat = new THREE.MeshStandardMaterial({ color: 0x252a2c, roughness: 0.34, metalness: 0.78 }); // metal: receiver/barrel/bolt
const gunPolyMat = new THREE.MeshStandardMaterial({ color: 0x171c1e, roughness: 0.86, metalness: 0.04 }); // polymer: grips/stocks/handguards
const gunLensMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.15, metalness: 0.1 }); // scope/optic glass

// ---- procedural surface texture: brushed-metal micro-noise + scratches, and a
// polymer grain — generated once on canvas and reused as map/roughnessMap across
// every weapon's shared metal/polymer materials (no external texture files, and
// reusing the same two textures everywhere keeps this effectively free).
function makeSurfaceTexture(size, baseGray, opts = {}) {
  const { grain = 0.08, scratches = 0, brushed = false } = opts;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${baseGray},${baseGray},${baseGray})`;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * grain;
    const v = Math.min(255, Math.max(0, baseGray + n));
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  if (brushed) {
    // directional brushed-metal streaks — faint horizontal lines with slight jitter
    ctx.globalAlpha = 0.05; ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const y = Math.random() * size;
      ctx.lineWidth = Math.random() * 0.9 + 0.2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (Math.random() - 0.5) * 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < scratches; i++) {
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.random() * 1.3 + 0.3;
    const x1 = Math.random() * size, y1 = Math.random() * size;
    const ang = Math.random() * Math.PI * 2, len = Math.random() * size * 0.35 + 5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const gunMetalTex = makeSurfaceTexture(128, 195, { grain: 0.1, scratches: 26, brushed: true });
gunMetalTex.repeat.set(4, 4);
const gunPolyTex = makeSurfaceTexture(96, 150, { grain: 0.18, scratches: 7 });
gunPolyTex.repeat.set(3, 3);
gunMat.map = gunMetalTex; gunMat.roughnessMap = gunMetalTex; gunMat.needsUpdate = true;
gunPolyMat.map = gunPolyTex; gunPolyMat.roughnessMap = gunPolyTex; gunPolyMat.needsUpdate = true;

const weaponModels = {};

// helper for the trigger guard — two thin polymer bars approximating the loop silhouette
function buildTriggerGuard(g, x, y, z) {
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.03), gunPolyMat);
  bottom.position.set(x, y - 0.045, z);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.03), gunPolyMat);
  front.position.set(x + 0.04, y - 0.02, z);
  g.add(bottom, front);
}

// Assault Rifle — receiver + barrel + muzzle + magazine + stock + red-dot optic + grip + trigger guard
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), gunMat);
  body.position.set(0.16, -0.14, -0.32);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.22), gunPolyMat);
  handguard.position.set(0.16, -0.15, -0.55);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.14, -0.64);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.05, 8), gunMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.16, -0.14, -0.78);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.17, 0.06), gunPolyMat);
  mag.position.set(0.16, -0.28, -0.32);
  mag.rotation.x = 0.15;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.18), gunPolyMat);
  stock.position.set(0.16, -0.14, -0.08);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), gunPolyMat);
  grip.position.set(0.16, -0.24, -0.16);
  grip.rotation.x = -0.3;
  // red-dot optic — mount rail + housing ring + a visible lens disc (also the anchor
  // point the 2D red-dot reticle overlay lines up with when ADS engages)
  const opticMount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.1), gunMat);
  opticMount.position.set(0.16, -0.065, -0.34);
  const opticHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.07, 10), gunMat);
  opticHousing.rotation.x = Math.PI / 2;
  opticHousing.position.set(0.16, -0.045, -0.34);
  const opticLens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), gunLensMat);
  opticLens.position.set(0.16, -0.045, -0.305);
  g.add(body, handguard, barrel, muzzle, mag, stock, grip, opticMount, opticHousing, opticLens);
  buildTriggerGuard(g, 0.16, -0.19, -0.2);
  g.visible = true;
  gunGroup.add(g);
  weaponModels.assault = g;
  g.magPart = mag;
  g.magBaseY = mag.position.y;
}
// Shotgun — receiver + barrel + muzzle + pump foregrip + grip + bead sight + trigger guard
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.28), gunMat);
  body.position.set(0.16, -0.16, -0.3);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.32, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.1, -0.46);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.025, 0.04, 8), gunMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.16, -0.1, -0.63);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.1), gunPolyMat);
  pump.position.set(0.16, -0.2, -0.42);
  const stockBox = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.1, 0.16), gunPolyMat);
  stockBox.position.set(0.16, -0.16, -0.1);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), gunPolyMat);
  grip.position.set(0.16, -0.26, -0.16);
  grip.rotation.x = -0.3;
  // basic sight picture — a simple rear notch + front bead, no optic (as specced: less
  // advanced than the AR's red dot)
  const rearNotch = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.015), gunMat);
  rearNotch.position.set(0.16, -0.09, -0.2);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), gunMat);
  bead.position.set(0.16, -0.075, -0.6);
  g.add(body, barrel, muzzle, pump, stockBox, grip, rearNotch, bead);
  buildTriggerGuard(g, 0.16, -0.21, -0.2);
  g.visible = false;
  gunGroup.add(g);
  weaponModels.shotgun = g;
  g.pumpPart = pump;
  g.pumpBaseZ = pump.position.z;
}
// Sniper — receiver + long barrel + muzzle + proper scope tube (objective/ocular
// lenses) + bipod + bolt handle + magazine + stock + grip + trigger guard
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.42), gunMat);
  body.position.set(0.16, -0.15, -0.36);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), gunPolyMat);
  handguard.position.set(0.16, -0.14, -0.62);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.13, -0.76);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.018, 0.06, 8), gunMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.16, -0.13, -0.93);
  // proper scope: tube body, wider objective bell at front, ocular lens at back
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 10), gunMat);
  scopeTube.rotation.x = Math.PI / 2;
  scopeTube.position.set(0.16, -0.035, -0.38);
  const scopeObjective = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 10), gunMat);
  scopeObjective.rotation.x = Math.PI / 2;
  scopeObjective.position.set(0.16, -0.035, -0.48);
  const scopeOcular = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), gunMat);
  scopeOcular.rotation.x = Math.PI / 2;
  scopeOcular.position.set(0.16, -0.035, -0.27);
  const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 10), gunLensMat);
  scopeLens.position.set(0.16, -0.035, -0.255);
  const scopeMountFront = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.02), gunMat);
  scopeMountFront.position.set(0.16, -0.065, -0.44);
  const scopeMountRear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.02), gunMat);
  scopeMountRear.position.set(0.16, -0.065, -0.32);
  // bipod — two thin angled legs folded forward under the handguard
  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 5), gunMat);
  bipodL.position.set(0.11, -0.21, -0.66); bipodL.rotation.z = 0.35; bipodL.rotation.x = 0.2;
  const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 5), gunMat);
  bipodR.position.set(0.21, -0.21, -0.66); bipodR.rotation.z = -0.35; bipodR.rotation.x = 0.2;
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), gunMat);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.set(0.2, -0.11, -0.2);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), gunPolyMat);
  mag.position.set(0.16, -0.22, -0.28);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.2), gunPolyMat);
  stock.position.set(0.16, -0.15, -0.06);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), gunPolyMat);
  grip.position.set(0.16, -0.24, -0.14);
  grip.rotation.x = -0.3;
  g.add(body, handguard, barrel, muzzle, scopeTube, scopeObjective, scopeOcular, scopeLens,
    scopeMountFront, scopeMountRear, bipodL, bipodR, bolt, mag, stock, grip);
  buildTriggerGuard(g, 0.16, -0.19, -0.18);
  g.visible = false;
  gunGroup.add(g);
  weaponModels.sniper = g;
  g.boltPart = bolt;
  g.boltBaseX = bolt.position.x;
  g.magPart = mag;
  g.magBaseY = mag.position.y;
}
// SMG — compact receiver + short barrel + stubby folded stock + iron sights + grip +
// trigger guard. Deliberately smaller/shorter than the assault rifle in every dimension.
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.082, 0.22), gunMat);
  body.position.set(0.16, -0.14, -0.22);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.14, -0.4);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.035, 8), gunMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.16, -0.14, -0.48);
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.1), gunPolyMat);
  foregrip.position.set(0.16, -0.19, -0.36);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.16, 0.05), gunPolyMat);
  mag.position.set(0.16, -0.27, -0.2);
  mag.rotation.x = 0.1;
  // stubby folded stock — a short brace rather than the AR's full stock
  const stockArm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.1), gunMat);
  stockArm.position.set(0.16, -0.12, -0.03);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.016), gunPolyMat);
  stockPad.position.set(0.16, -0.14, 0.02);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.12, 0.046), gunPolyMat);
  grip.position.set(0.16, -0.23, -0.13);
  grip.rotation.x = -0.3;
  // simple rear notch + front bead iron sights (no optic — compact SMG, not the AR's red dot)
  const rearNotch = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.012), gunMat);
  rearNotch.position.set(0.16, -0.09, -0.13);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), gunMat);
  bead.position.set(0.16, -0.085, -0.44);
  g.add(body, barrel, muzzle, foregrip, mag, stockArm, stockPad, grip, rearNotch, bead);
  buildTriggerGuard(g, 0.16, -0.18, -0.1);
  g.visible = false;
  gunGroup.add(g);
  weaponModels.smg = g;
  g.magPart = mag;
  g.magBaseY = mag.position.y;
}
// LMG — large receiver + long heavy barrel + bipod legs + big drum magazine + carry
// handle + trigger guard. Deliberately larger/heavier-looking than every other weapon.
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.46), gunMat);
  body.position.set(0.16, -0.14, -0.34);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.26), gunPolyMat);
  handguard.position.set(0.16, -0.14, -0.64);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.38, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, -0.14, -0.86);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.02, 0.06, 8), gunMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0.16, -0.14, -1.04);
  // large drum magazine, hanging below the receiver
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.055, 16), gunPolyMat);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0.16, -0.3, -0.26);
  // bipod legs, folded forward under the handguard (same construction idiom as the sniper's)
  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), gunMat);
  bipodL.position.set(0.1, -0.24, -0.68); bipodL.rotation.z = 0.4; bipodL.rotation.x = 0.15;
  const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), gunMat);
  bipodR.position.set(0.22, -0.24, -0.68); bipodR.rotation.z = -0.4; bipodR.rotation.x = 0.15;
  // top carry handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.1), gunMat);
  handle.position.set(0.16, -0.045, -0.4);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.2), gunPolyMat);
  stock.position.set(0.16, -0.15, -0.04);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.13, 0.052), gunPolyMat);
  grip.position.set(0.16, -0.25, -0.14);
  grip.rotation.x = -0.3;
  g.add(body, handguard, barrel, muzzle, drum, bipodL, bipodR, handle, stock, grip);
  buildTriggerGuard(g, 0.16, -0.2, -0.2);
  g.visible = false;
  gunGroup.add(g);
  weaponModels.lmg = g;
  g.magPart = drum;
  g.magBaseY = drum.position.y;
}

// Fine weapon detailing: rail slots, ejection port, selector, pins, barrel bands and grip texture.
// These are separate low-cost meshes attached to each viewmodel, not decorative world objects.
const gunDetailMat = new THREE.MeshStandardMaterial({color:0x111416, roughness:.7, metalness:.42});
const gunEdgeMat = new THREE.MeshStandardMaterial({color:0x535b60, roughness:.36, metalness:.82});
const gunMarkMat = new THREE.MeshStandardMaterial({color:0x8c969a, roughness:.42, metalness:.65});
function addGunDetails(key, g) {
  const box = (w,h,d,x,y,z,mat=gunDetailMat) => {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); return m;
  };
  const cyl = (r1,r2,len,x,y,z,mat=gunEdgeMat,segments=10) => {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,len,segments),mat);
    m.rotation.x=Math.PI/2; m.position.set(x,y,z); m.castShadow=true; g.add(m); return m;
  };
  // Picatinny-style top rail teeth and small receiver pins.
  for(let i=0;i<9;i++) box(.052,.009,.018,.16,-.078,-.43-i*.026,gunEdgeMat);
  for(const z of [-.23,-.36,-.48]) {
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.006,8),gunMarkMat);
    pin.rotation.x=Math.PI/2; pin.position.set(.115,-.15,z); g.add(pin);
  }
  if(key==='assault') {
    box(.007,.047,.11,.203,-.135,-.31,gunDetailMat); // ejection port
    box(.012,.014,.055,.211,-.12,-.30,gunEdgeMat); // bolt cover
    box(.012,.018,.04,.113,-.185,-.23,gunMarkMat); // selector lever
    for(let i=0;i<7;i++) box(.078,.008,.012,.16,-.153,-.48-i*.024,gunEdgeMat);
    cyl(.014,.014,.028,.16,-.14,-.80,gunEdgeMat,12); // muzzle crown
    // textured magazine ribs
    for(let i=0;i<5;i++) box(.052,.008,.042,.16,-.235-i*.022,-.32,gunDetailMat);
    // sling swivel loop + handguard vent slits + receiver screws, for extra surface texture
    const arSling=new THREE.Mesh(new THREE.TorusGeometry(.015,.0035,6,10),gunEdgeMat);
    arSling.position.set(.16,-.105,-.1);arSling.rotation.y=Math.PI/2;g.add(arSling);
    for(let i=0;i<3;i++) box(.012,.004,.05,.198,-.16,-.5-i*.05,gunDetailMat);
    for(const z of [-.18,-.42,-.6]) box(.006,.006,.006,.197,-.1,z,gunMarkMat);
  } else if(key==='shotgun') {
    for(let i=0;i<6;i++) box(.09,.008,.012,.16,-.166,-.37-i*.014,gunEdgeMat);
    box(.012,.045,.09,.215,-.15,-.31,gunDetailMat);
    cyl(.024,.024,.018,.16,-.10,-.65,gunEdgeMat,12);
    // shell carrier and two brass shell ends
    box(.012,.06,.12,.22,-.22,-.28,gunDetailMat);
    for(let i=0;i<2;i++){
      const shell=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.016,10),new THREE.MeshStandardMaterial({color:0x9d5529,roughness:.45,metalness:.35}));
      shell.rotation.x=Math.PI/2;shell.position.set(.229,-.205-i*.03,-.31);g.add(shell);
    }
    // sling swivel loop + receiver screws
    const sgSling=new THREE.Mesh(new THREE.TorusGeometry(.015,.0035,6,10),gunEdgeMat);
    sgSling.position.set(.16,-.12,-.05);sgSling.rotation.y=Math.PI/2;g.add(sgSling);
    for(const z of [-.2,-.36]) box(.006,.006,.006,.218,-.11,z,gunMarkMat);
  } else if(key==='sniper') {
    // precision rifle: longer fluted barrel, larger bolt knob and scope adjustment turrets
    for(let i=0;i<8;i++) cyl(.016,.016,.009,.16,-.13,-.61-i*.038,gunEdgeMat,8);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),gunEdgeMat);
    knob.position.set(.225,-.11,-.20);g.add(knob);
    cyl(.036,.036,.035,.16,-.035,-.49,gunEdgeMat,12);
    box(.075,.008,.13,.16,-.19,-.61,gunDetailMat);
    for(let i=0;i<5;i++) box(.06,.007,.01,.16,-.14,-.55-i*.025,gunEdgeMat);
    // radial muzzle-brake slots + windage/elevation scope turret caps + sling loop
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      const slot=new THREE.Mesh(new THREE.BoxGeometry(.006,.016,.016),gunDetailMat);
      slot.position.set(.16+Math.cos(a)*.019,-.13+Math.sin(a)*.019,-.90);
      g.add(slot);
    }
    const turretW=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.018,8),gunEdgeMat);
    turretW.position.set(.195,-.035,-.38);g.add(turretW);
    const turretE=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.018,8),gunEdgeMat);
    turretE.rotation.z=Math.PI/2;turretE.position.set(.16,0,-.38);g.add(turretE);
    const skSling=new THREE.Mesh(new THREE.TorusGeometry(.015,.0035,6,10),gunEdgeMat);
    skSling.position.set(.16,-.11,-.08);skSling.rotation.y=Math.PI/2;g.add(skSling);
  } else if(key==='smg') {
    // compact SMG: short rail teeth, small ejection port, sling loop, receiver screws
    for(let i=0;i<4;i++) box(.07,.007,.01,.16,-.155,-.3-i*.022,gunEdgeMat);
    box(.006,.03,.07,.196,-.13,-.2,gunDetailMat); // ejection port
    const smgSling=new THREE.Mesh(new THREE.TorusGeometry(.012,.003,6,10),gunEdgeMat);
    smgSling.position.set(.16,-.1,-.05);smgSling.rotation.y=Math.PI/2;g.add(smgSling);
    for(const z of [-.16,-.3]) box(.005,.005,.005,.195,-.09,z,gunMarkMat);
  } else if(key==='lmg') {
    // LMG: heat-shield vents on the handguard, ammo-feed tray detail, receiver screws
    for(let i=0;i<10;i++) box(.065,.007,.012,.16,-.168,-.55-i*.02,gunEdgeMat);
    for(let i=0;i<4;i++) box(.012,.05,.018,.12+i*.027,-.08,-.63,gunDetailMat); // handguard vent slits
    box(.02,.05,.14,.16,-.225,-.3,gunDetailMat); // feed tray / drum mount block
    for(const z of [-.22,-.45,-.7]) box(.007,.007,.007,.21,-.1,z,gunMarkMat);
  } else {
    // unrecognised weapon key — add nothing rather than guessing a silhouette that
    // doesn't match, so a future weapon degrades to "plain" instead of "wrong".
  }
}
addGunDetails('assault', weaponModels.assault);
addGunDetails('shotgun', weaponModels.shotgun);
addGunDetails('sniper', weaponModels.sniper);
addGunDetails('smg', weaponModels.smg);
addGunDetails('lmg', weaponModels.lmg);

// First-person arms/hands (procedural fallback) — simple sleeves + hands gripping the
// weapon. Wrapped in their own group so they can be hidden for whichever weapon is
// showing the real scanned AK47 model below (which brings its own hands), while
// staying visible — unchanged — for the shotgun and sniper.
const fpSkinMat = new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: 0.88, metalness: 0.02 }); // dark tactical gloves
const fpSleeveMat = new THREE.MeshStandardMaterial({ color: 0x303b3c, roughness: 0.9 });
const fpCuffMat = new THREE.MeshStandardMaterial({color:0x151b1d,roughness:.92});
const fpKnuckleMat = new THREE.MeshStandardMaterial({color:0x465052,roughness:.82});
const primitiveArmsGroup = new THREE.Group();
{
  const pa = primitiveArmsGroup;
  // trigger (right) hand + forearm — near the grip
  const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.24), fpSleeveMat);
  rForearm.position.set(0.19, -0.28, -0.16);
  rForearm.rotation.x = -0.25;
  const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(.048,.052,.07,10),fpCuffMat);
  rCuff.rotation.x=Math.PI/2;rCuff.position.set(.19,-.28,-.22);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.071, 0.065, 0.09), fpSkinMat);
  rHand.position.set(0.17, -0.22, -0.24);
  rHand.rotation.x=-.12;
  pa.add(rForearm, rCuff, rHand);
  for(let i=0;i<4;i++){
    const knuckle=new THREE.Mesh(new THREE.SphereGeometry(.012,7,6),fpKnuckleMat);
    knuckle.position.set(.145+i*.015,-.194,-.275);pa.add(knuckle);
  }
  const thumb=new THREE.Mesh(new THREE.BoxGeometry(.026,.028,.06),fpSkinMat);
  thumb.position.set(.215,-.205,-.24);thumb.rotation.z=-.45;pa.add(thumb);

  // Support hand in a tactical glove wraps the foregrip.
  const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.28), fpSleeveMat);
  lForearm.position.set(0.1, -0.16, -0.42);
  lForearm.rotation.x = 0.35;
  const lCuff=new THREE.Mesh(new THREE.CylinderGeometry(.047,.05,.06,10),fpCuffMat);
  lCuff.rotation.x=Math.PI/2;lCuff.position.set(.1,-.16,-.34);
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.10), fpSkinMat);
  lHand.position.set(0.15, -0.17, -0.5);
  pa.add(lForearm,lCuff,lHand);
  for(let i=0;i<4;i++){
    // CylinderGeometry is supported by the game's Three.js build; use short tapered
    // segments instead of CapsuleGeometry, which is unavailable in the pinned version.
    const finger=new THREE.Mesh(new THREE.CylinderGeometry(.008,.01,.045,6),fpSkinMat);
    finger.position.set(.125+i*.015,-.19,-.49);finger.rotation.x=Math.PI/2;pa.add(finger);
  }
  gunGroup.add(pa);
}
camera.add(gunGroup);

/* ============================================================
   REAL SCANNED FIRST-PERSON MODEL — shared rig for all weapons
   A fully rigged, skinned AK47 + first-person arms/hands model (not procedural
   geometry), fetched at startup from assets/ak47.glb and parsed with
   THREE.GLTFLoader. Ships with its own baked "idle"/"fire"/
   "reload_empty" animation clips, played through a THREE.AnimationMixer.
   It is loaded asynchronously, so the procedural weapons built above are left
   in place and only adjusted once the real model has actually finished
   loading — if parsing ever fails for any reason, every weapon keeps working
   exactly as before (procedural gun + primitive arms) instead of leaving the
   player with nothing to see.

   Once loaded, the rig's hands/arms are reused for EVERY weapon, not just the
   assault rifle: a standalone Node traversal of this exact embed (see the
   investigation scratch dir referenced in the verification report) found the
   model is three skinned meshes sharing one skeleton —
     "SkeletalMeshComponent0_0" (material "arm")  — skinned to the arm bones
     "SkeletalMeshComponent0_1" (material "hand") — skinned to the hand/finger bones
     "SMDImport"                (material "Material.002") — skinned almost
       entirely (>95% of total skin weight) to a separate "gun"/"magazine"/
       "slider"/"trigger"/"magazine_button" bone group — i.e. the AK47 body
       itself is cleanly isolated from the hands on its own bones.
   So for the assault rifle we show "SMDImport" as before; for every other
   weapon we hide it and instead socket that weapon's own existing procedural
   gun-body group onto the "gun" bone via Object3D.attach(), which reparents
   while preserving the group's current WORLD transform — since each
   procedural group started life as an untransformed direct child of
   gunGroup, it lands in exactly the same visual spot it already occupied, and
   from then on rides the bone's idle/fire/reload animation like the real gun
   mesh does. This was verified end-to-end (position preserved on attach,
   then moves correctly once the mixer animates the bone) in the same Node
   harness — see the verification report for what could/couldn't be confirmed
   without an actual browser.
   Credit: "Ak47" by kursat_sokmen (https://skfb.ly/6UEL9), CC BY 4.0.
   ============================================================ */
let realAssaultMixer = null, realAssaultActions = null, realAssaultLoaded = false;
let realGunMesh = null, realGunBone = null, realHandsGroup = null;
// Weapons that reuse the scanned rig's hands once it has loaded. Earlier
// builds also tried to re-socket each non-assault weapon's procedural body
// onto the rig's "gun" bone via Object3D.attach(), so the body would ride
// the bone's own animation — but that broke in real (hardware-rendered)
// Chrome in ways two separate rounds of fixes (stale matrixWorld at attach
// time, then frustum culling on the scaled/animated bone subtree) didn't
// fully resolve. Rather than keep patching an approach that can't be
// verified without a real browser, every non-assault weapon's body now just
// stays a normal static child of gunGroup — the exact same positioning this
// game used for all three original weapons for most of its development,
// before the AK rig existed, and which never had this problem. Only the
// hands/arms are shared from the real rig; each gun body sits in its own
// already-tuned fixed spot instead of chasing the rig's bone animation.
// Only the assault rifle gets the real scanned model. Socketing the other
// weapons' procedural bodies onto its "gun" bone (reusing one rig across all
// five) went through two rounds of real, verified-in-isolation fixes
// (stale-matrixWorld placement, then frustum-culling) that both held up
// across repeated headless re-testing — multiple camera angles, after firing,
// mid-wave — yet still didn't hold up in an actual browser. Rather than
// chase a third theory on a mechanism that keeps looking fixed and isn't,
// shotgun/sniper/smg/lmg fall back to the plain primitive arms they used
// before any of this — the one state that's been reliably correct the whole
// time. Each weapon gets a real model of its own, like the AK47, only when
// an actual matching asset is embedded for it (see loadRealAssaultModel and
// its sibling loaders, if/when they exist) — never by reusing this bone.
const REAL_HANDS_WEAPONS = new Set(['assault']);
function updatePrimitiveArmsVisibility() {
  const useRealHands = realAssaultLoaded && REAL_HANDS_WEAPONS.has(currentWeaponKey);
  primitiveArmsGroup.visible = !useRealHands;
  // The scanned rig's hands/arms (realHandsGroup) used to be left visible
  // unconditionally the moment the model finished loading, on the old
  // assumption that every weapon would share it. That assumption is gone
  // (see REAL_HANDS_WEAPONS above) but this toggle was never added back in,
  // so the real hands kept rendering behind/through every other weapon's
  // primitive arms and gun body at the same time — exactly the "hand isn't
  // holding the gun" look being reported, since two different hand models
  // were occupying the same space. Gate it the same way as the primitive
  // arms, just inverted.
  if (realHandsGroup) realHandsGroup.visible = useRealHands;
}
function loadRealAssaultModel() {
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve();
  // Previously this model shipped as an ~18MB base64 string baked directly
  // into the HTML (atob'd into bytes at startup). Moving to a GitHub repo
  // meant splitting the game into real files instead of one huge HTML blob,
  // so the model now lives as its own binary asset (assets/ak47.glb, ~13.8MB
  // — base64 always inflates size by ~33%, so this is also just smaller) and
  // is fetched like any other asset. fetch() of a local file needs an actual
  // HTTP server (file:// URLs block this via CORS) — see the README for how
  // to run one; GitHub Pages serves it correctly with no setup.
  // Returns a promise that resolves once this is done (success OR failure) —
  // used below to make sure the shotgun/LMG real models only start
  // downloading after this one (by far the biggest asset) is fully settled,
  // instead of all three competing for bandwidth/memory at once on page load.
  return fetch('assets/ak47.glb')
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.arrayBuffer();
    })
    .then((buffer) => new Promise((resolveOuter) => {
      new THREE.GLTFLoader().parse(buffer, '', (gltf) => {
    const realGroup = new THREE.Group();
    const model = gltf.scene;
    model.animations = gltf.animations; // GLTFLoader puts clips on gltf.animations, not gltf.scene.animations
    model.scale.set(0.05, 0.05, 0.05);
    model.position.set(0.04, -0.02, 0.0);
    model.rotation.set(THREE.MathUtils.degToRad(5), THREE.MathUtils.degToRad(185), 0);
    model.traverse((child) => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; child.frustumCulled = false; } });
    realGroup.add(model);
    gunGroup.add(realGroup);
    realHandsGroup = realGroup; // exposed module-level so updatePrimitiveArmsVisibility can gate it per weapon

    realAssaultMixer = new THREE.AnimationMixer(model);
    realAssaultActions = {};
    (model.animations || []).forEach((clip) => {
      const action = realAssaultMixer.clipAction(clip);
      realAssaultActions[clip.name] = action;
    });
    if (realAssaultActions.idle) { realAssaultActions.idle.setLoop(THREE.LoopRepeat); realAssaultActions.idle.play(); }

    realGunMesh = model.getObjectByName('SMDImport');
    realGunBone = model.getObjectByName('gun');

    weaponModels.assault.visible = false; // hide the procedural fallback
    weaponModels.assault = realGunMesh || realGroup; // if the mesh name ever doesn't match, fall back to showing/hiding the whole rig for assault rather than breaking
    realAssaultLoaded = true;

    // No bone-socketing here anymore (see the comment on REAL_HANDS_WEAPONS
    // above for why) — each non-assault weapon's procedural body simply stays
    // where it already was, as a normal static child of gunGroup. Nothing to
    // reparent, so nothing for a stale-matrix or culling bug to break. Keep
    // frustumCulled off on them anyway, cheap insurance against this exact
    // class of "part of the view-model vanishes at some angles" bug.
    REAL_HANDS_WEAPONS.forEach((key) => {
      if (key === 'assault') return; // the real gun mesh itself, handled separately above
      const g = weaponModels[key];
      if (g) g.traverse((child) => { if (child.isMesh) child.frustumCulled = false; });
    });

    Object.keys(weaponModels).forEach((k) => { weaponModels[k].visible = (k === currentWeaponKey); });
    updatePrimitiveArmsVisibility(); // sets both primitiveArmsGroup and realHandsGroup visibility correctly for whichever weapon is currently equipped
        resolveOuter();
      }, (err) => {
        console.error('AK47 model: failed to parse, keeping procedural fallback.', err);
        resolveOuter();
      });
    }))
    .catch((err) => {
      console.error('AK47 model: failed to fetch assets/ak47.glb, keeping procedural fallback. ' +
        'If you opened this file directly (file://), browsers block fetch() of local files — ' +
        'serve it over HTTP instead (see README.md).', err);
    });
}

/* ============================================================
   REAL STATIC WEAPON MODELS — shotgun + LMG
   Unlike the AK47 above, these are plain static meshes (no skin, no rig,
   no baked animation) — real-world gun scans (Remington 870 MCS, Browning
   M2) pulled in to replace the procedural box-and-cylinder gun bodies with
   something that actually looks like the weapon. Because they're static,
   none of the bone-attach/frustum-culling trouble the AK47 rig caused
   applies here: each one is just swapped in as an ordinary child of the
   existing weaponModels group, in exactly the spot the procedural body
   used to occupy, so every bit of per-weapon logic that already works
   (visibility toggling on weapon switch, the pump/mag-drop animation refs,
   primitive arms holding it) keeps working unchanged.
   Credits: "870 MCS Shotgun" and "Low Poly Browning M2E2", both via
   Sketchfab — see README.md for exact attribution once confirmed.
   ============================================================ */
function loadRealStaticGunBody(weaponKey, url, fit) {
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve();
  const g = weaponModels[weaponKey];
  if (!g) return Promise.resolve();
  return fetch(url)
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer(); })
    .then((buffer) => new Promise((resolve, reject) => {
      new THREE.GLTFLoader().parse(buffer, '', resolve, reject);
    }))
    .then((gltf) => {
      const model = gltf.scene;
      // The shotgun source file bakes two full copies of the gun side by side
      // (every part duplicated as a Blender-style ".001"/".002"-suffixed
      // sibling — likely two display states exported together). This loader's
      // GLTFLoader strips the dot from those suffixes when it names the
      // THREE.js nodes (so "Barrel_low.004" becomes "Barrel_low004"), which a
      // dot-anchored regex would miss — matched here by the trailing digits
      // alone instead. The LMG file doesn't have this problem (checked: 0
      // duplicates), so this is a no-op for it.
      let container = model;
      while (container.children.length === 1) container = container.children[0];
      const seenBase = new Set();
      const dupes = [];
      container.children.forEach((child) => {
        const base = child.name.replace(/\.?\d{3}$/, '');
        if (seenBase.has(base)) dupes.push(child); else seenBase.add(base);
      });
      dupes.forEach((c) => container.remove(c));
      // Hide (not remove) the procedural parts — g.pumpPart/g.magPart etc. are
      // still referenced by the per-frame fire/reload animation code, and
      // letting that code keep nudging an invisible mesh around is harmless,
      // whereas ripping those children out risks breaking that code.
      g.children.slice().forEach((child) => { child.visible = false; });
      model.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = false; child.frustumCulled = false; }
      });
      // Center the model on its own bounding box, then apply the per-weapon
      // scale/position/rotation that lines it up where the procedural body
      // used to sit (tuned by eye against the actual viewmodel — these
      // exports come in at an arbitrary real-world scale/orientation, not
      // the game's small hand-held-sized local space).
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.scale.setScalar(fit.scale);
      wrapper.position.set(fit.x, fit.y, fit.z);
      wrapper.rotation.set(fit.rx || 0, fit.ry || 0, fit.rz || 0);
      g.add(wrapper);
    })
    .catch((err) => {
      // console.error (not warn) so this isn't silently hidden by a devtools
      // console filter set to "Errors" only — a real possibility given a
      // previous report of "no console errors" that this code's old
      // console.warn calls wouldn't have shown up under.
      console.error('Real ' + weaponKey + ' model: failed to load ' + url + ', keeping procedural fallback.', err);
    });
}
// Re-enabled, but no longer fired in parallel with the AK47 load. Previously
// all three fetches (AK47 ~13.8MB, shotgun ~6.8MB, LMG ~2MB — ~22.6MB total)
// kicked off at once on page load; a player reported the AK47 breaking (and
// the shotgun not appearing) only after these two were added, which this
// sandbox's headless/software-rendered testing was never able to reproduce.
// The leading theory, since it fits every known fact (no console error, no
// repro on a fast dev machine, the texture-free LMG was the only one of the
// three still working): real-hardware bandwidth/memory contention from three
// large concurrent downloads+parses on page load. Loading the AK47 first and
// only starting the shotgun once it's fully settled (success OR failure),
// then the LMG once the shotgun is settled, removes that contention without
// needing to prove the theory — worst case it's merely unnecessary, not
// harmful. If this still breaks, that fact alone (parallel loading uninvolved)
// strongly points at something intrinsic to one of the two static models.
//
// Disabled again: the sequential-loading fix above did not resolve it — the
// player still saw errors with both real models enabled. Going back to the
// one confirmed-stable state (AK47 only) rather than leave the live game
// broken. The two calls and the loader function above are left in place,
// untouched, for whenever this gets picked back up.
loadRealAssaultModel().then(() => {
  // Environment props load one at a time, AFTER the AK47 has fully settled
  // (success or failure) — same real-hardware-contention mitigation as the
  // shotgun/LMG sequencing above, applied here from the start rather than
  // learned the hard way again. ~7.3MB combined (container 5.6MB, barrier
  // 0.9MB, sandbag 0.7MB) spread across three settled-one-after-another
  // fetches instead of three more concurrent ones stacked on page load.
  return loadRealEnvProp('assets/shipping_container.glb', [
    { x: -7, z: 6, ry: 0 },
    { x: -5, z: -5, ry: 0.35 },
    { x: 0, z: 10, ry: -0.2 },
    { x: -22, z: -14, ry: 1.0 },
  ], { scale: 0.0065, surface: 'metal' });
}).then(() => {
  return loadRealEnvProp('assets/concrete_barrier.glb', [
    { x: -4.6, z: -20, ry: Math.PI / 2 },
    { x: 4.6, z: -12, ry: Math.PI / 2 },
    { x: -4.6, z: -2, ry: Math.PI / 2 },
    { x: 4.6, z: 6, ry: Math.PI / 2 },
    { x: -4.6, z: 14, ry: Math.PI / 2 },
  ], { scale: 0.0095, surface: 'rock' });
}).then(() => {
  return loadRealEnvProp('assets/sandbag_wall.glb', [
    { x: -19, z: -19, ry: 0.9 },
    { x: -27, z: -16, ry: 0.15 },
  ], { scale: 0.01524, surface: 'wood', skipCollider: true });
}).then(() => {
  // Real Poly Haven boulder (CC0), converted from its source .blend file and
  // swapped in for the hand-placed procedural rocks (the ones the player
  // actually walks past — see rockSwapCutoff above). ~2.6MB, last in the
  // sequential chain so it doesn't compete with anything else loading.
  return loadRealBoulders('assets/boulder_real.glb', rockSwapCutoff);
});
// Real shotgun/LMG static-model swap stays disabled — this is the
// confirmed-stable AK47-only state for weapons (see loadRealStaticGunBody
// above and its disable note). The env-prop chain above is new/separate and
// doesn't touch the weapon loaders either way.
// loadRealAssaultModel().then(() => {
//   return loadRealStaticGunBody('shotgun', 'assets/shotgun_real.glb', { scale: 0.0044, x: 0.16, y: -0.17, z: -0.42, ry: Math.PI / 2 });
// }).then(() => {
//   return loadRealStaticGunBody('lmg', 'assets/lmg_real.glb', { scale: 0.11, x: 0.16, y: -0.12, z: -0.48, ry: -Math.PI / 2 });
// });

// Shared rig actions — despite the name, these drive the one scanned rig's
// idle/fire/reload clips and are reused by every weapon in REAL_HANDS_WEAPONS,
// not just the assault rifle (see playRigFire/playRigReload below).
function playRealAssaultFire() {
  if (!realAssaultActions || !realAssaultActions.fire) return;
  const a = realAssaultActions.fire;
  a.reset(); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; a.timeScale = 1; a.play();
}
function playRealAssaultReload(durationSec) {
  if (!realAssaultActions || !realAssaultActions.reload_empty) return;
  const a = realAssaultActions.reload_empty;
  a.reset(); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true;
  a.timeScale = durationSec > 0 ? (a.getClip().duration / durationSec) : 1;
  a.play();
}
// Thin, clearly-named aliases used by tryShoot()/startReload() for every
// weapon that reuses the rig (generalizes the two functions above).
function playRigFire() { playRealAssaultFire(); }
function playRigReload(durationSec) { playRealAssaultReload(durationSec); }

const muzzleFlash = new THREE.PointLight(0xffb060, 0, 4);
muzzleFlash.position.set(0.16, -0.14, -0.55);
camera.add(muzzleFlash);
const flashMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.05, 0.14, 6),
  new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0 })
);
flashMesh.rotation.x = Math.PI / 2;
flashMesh.position.set(0.16, -0.14, -0.58);
camera.add(flashMesh);

// Soft radial glow texture — shared by the muzzle flash and impact sparks (one texture, reused).
function makeGlowTexture(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,210,140,0.85)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const glowTex = makeGlowTexture(64);

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

/* ============================================================
   PICKUPS — ammo crates and medikits, dropped by killed bots
   A small pooled set of physical props (same pooling convention as the
   particle effects above), spawned at a dead bot's feet with some
   probability, that bob/spin in place until the player walks over them
   (or they time out and despawn). References to `player`, `weapon` and
   the HUD update functions below are fine even though those are defined
   further down the file — nothing here runs until the game loop calls
   updatePickups(), by which point everything is set up.
   ============================================================ */
const ammoCrateMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.8, metalness: 0.1 });
const ammoCrateBandMat = new THREE.MeshStandardMaterial({ color: 0xd8b458, roughness: 0.6, metalness: 0.3 });
const medkitBodyMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.55, metalness: 0.05 });
const medkitCrossMat = new THREE.MeshStandardMaterial({ color: 0xd8382a, roughness: 0.5, metalness: 0.05, emissive: 0x4a0f0a, emissiveIntensity: 0.4 });

// Bumped noticeably larger than a "realistic" crate/kit would be (2.3x the
// original size) specifically so they read clearly at a glance across the
// arena instead of blending into the ground clutter — legibility over scale
// accuracy for a pickup the player needs to spot while fighting.
const PICKUP_MESH_SCALE = 2.3;
function buildAmmoCrateMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.24), ammoCrateMat);
  g.add(box);
  [-0.09, 0.09].forEach((x) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.26), ammoCrateBandMat);
    band.position.x = x;
    g.add(band);
  });
  g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.frustumCulled = false; } });
  g.scale.setScalar(PICKUP_MESH_SCALE);
  return g;
}
function buildMedkitMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.22), medkitBodyMat);
  g.add(box);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.03), medkitCrossMat);
  crossH.position.set(0, 0.02, 0.115);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.17, 0.03), medkitCrossMat);
  crossV.position.set(0, 0.02, 0.115);
  g.add(crossH, crossV);
  g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.frustumCulled = false; } });
  g.scale.setScalar(PICKUP_MESH_SCALE);
  return g;
}

const PICKUP_POOL_SIZE = 10;
const PICKUP_LIFETIME = 22; // seconds before an uncollected drop despawns
const PICKUP_RADIUS = 1.3; // walk-over collection distance (xz, meters) — widened slightly to match the bigger mesh
const pickupPool = [];
for (let i = 0; i < PICKUP_POOL_SIZE; i++) {
  const group = new THREE.Group();
  group.visible = false;
  const ammoMesh = buildAmmoCrateMesh();
  const medkitMesh = buildMedkitMesh();
  group.add(ammoMesh, medkitMesh);
  scene.add(group);
  pickupPool.push({ group, ammoMesh, medkitMesh, type: null, active: false, life: 0, bobT: Math.random() * 10, baseY: 0 });
}
let pickupCursor = 0;

function spawnPickup(point) {
  // Roughly 40% of kills drop something; of those, ammo is somewhat more
  // common than a medikit (crates feel more frequent than first-aid in
  // most shooters, and ammo pressure is the more constant need here).
  if (Math.random() > 0.4) return;
  const type = Math.random() < 0.6 ? 'ammo' : 'health';
  const p = pickupPool[pickupCursor]; pickupCursor = (pickupCursor + 1) % PICKUP_POOL_SIZE;
  p.type = type;
  p.active = true;
  p.life = 0;
  p.bobT = Math.random() * 10;
  p.baseY = 0.32; // raised to clear the ground at the new, larger mesh scale
  p.group.position.set(point.x, p.baseY, point.z);
  p.group.rotation.y = Math.random() * Math.PI * 2;
  p.group.visible = true;
  p.ammoMesh.visible = type === 'ammo';
  p.medkitMesh.visible = type === 'health';
  setPickupOpacity(p, 1);
}
function setPickupOpacity(p, alpha) {
  // Fade-out just before despawn; simplest is scaling down rather than
  // juggling material transparency across six differently-shared materials.
  const s = Math.max(0.001, alpha);
  p.group.scale.set(s, s, s);
}
function collectPickup(p) {
  if (p.type === 'ammo') {
    if (weapon.reserve >= weapon.reserveMax) return false; // leave it for later — current weapon is already full
    const amount = Math.round(weapon.reserveMax * (0.3 + Math.random() * 0.25));
    weapon.reserve = Math.min(weapon.reserveMax, weapon.reserve + amount);
    updateAmmoHUD();
    sfxPickupAmmo();
    showPickupPopup('+' + amount + ' AMMO', 'ammo');
  } else {
    if (player.health >= player.maxHealth) return false; // leave it — nothing to heal right now
    const amount = 35;
    player.health = Math.min(player.maxHealth, player.health + amount);
    updateHealthHUD();
    sfxPickupHealth();
    showPickupPopup('+' + amount + ' HP', 'health');
  }
  return true;
}
function updatePickups(dt) {
  for (const p of pickupPool) {
    if (!p.active) continue;
    p.life += dt;
    p.bobT += dt;
    p.group.position.y = p.baseY + Math.sin(p.bobT * 2.1) * 0.05;
    p.group.rotation.y += dt * 0.9;
    const remaining = PICKUP_LIFETIME - p.life;
    if (remaining < 1.2) setPickupOpacity(p, Math.max(0, remaining / 1.2));
    if (p.life >= PICKUP_LIFETIME) { p.active = false; p.group.visible = false; continue; }
    const dx = p.group.position.x - player.pos.x;
    const dz = p.group.position.z - player.pos.z;
    if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
      if (collectPickup(p)) { p.active = false; p.group.visible = false; }
    }
  }
}
function showPickupPopup(text, kind) {
  const el = document.getElementById('pickup-popup');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show', 'ammo', 'health'); void el.offsetWidth;
  el.classList.add('show', kind);
}

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

/* ============================================================
   WEAPONS — three loadouts, switchable; each keeps its own ammo/cooldown
   ============================================================ */
const WEAPON_DEFS = {
  assault: {
    name: 'Assault Rifle', damage: 22, fireInterval: 0.11, magSize: 30, reserveMax: 90,
    reloadTime: 1.5, range: 60, spread: 0.022, pellets: 1,
    recoilPerShot: 0.05, recoilMax: 0.14, adsFov: 55,
    muzzleScale: 1.0, flashColor: 0xffcf8a, casingScale: 1.0, casingColor: 0xd8b458,
    muzzleOffset: new THREE.Vector3(0.16, -0.12, -0.68),
    casingOffset: new THREE.Vector3(0.2, -0.12, -0.4),
    camShake: 0.014, flashDecay1: 20, flashDecay2: 50, recoilDecayRate: 10,
  },
  shotgun: {
    name: 'Shotgun', damage: 9, fireInterval: 0.85, magSize: 6, reserveMax: 24,
    reloadTime: 2.1, range: 22, spread: 0.11, pellets: 8,
    recoilPerShot: 0.1, recoilMax: 0.18, adsFov: 60,
    muzzleScale: 1.5, flashColor: 0xffd9a0, casingScale: 1.6, casingColor: 0xd84a3a,
    muzzleOffset: new THREE.Vector3(0.16, -0.1, -0.64),
    casingOffset: new THREE.Vector3(0.2, -0.16, -0.3),
    camShake: 0.05, flashDecay1: 45, flashDecay2: 130, recoilDecayRate: 6,
  },
  sniper: {
    name: 'Sniper', damage: 95, fireInterval: 1.3, magSize: 5, reserveMax: 20,
    reloadTime: 2.4, range: 100, spread: 0.0015, pellets: 1,
    recoilPerShot: 0.16, recoilMax: 0.2, adsFov: 28,
    muzzleScale: 1.2, flashColor: 0xdfefff, casingScale: 1.3, casingColor: 0xc9a24a,
    muzzleOffset: new THREE.Vector3(0.16, -0.13, -0.88),
    casingOffset: new THREE.Vector3(0.2, -0.14, -0.34),
    camShake: 0.065, flashDecay1: 28, flashDecay2: 90, recoilDecayRate: 4.5,
  },
  smg: {
    name: 'SMG', damage: 15, fireInterval: 0.07, magSize: 32, reserveMax: 128,
    reloadTime: 1.1, range: 32, spread: 0.034, pellets: 1,
    recoilPerShot: 0.028, recoilMax: 0.1, adsFov: 58, adsSpeed: 1.3,
    muzzleScale: 0.85, flashColor: 0xffcf8a, casingScale: 0.85, casingColor: 0xd8b458,
    muzzleOffset: new THREE.Vector3(0.16, -0.12, -0.5),
    casingOffset: new THREE.Vector3(0.2, -0.12, -0.3),
    camShake: 0.01, flashDecay1: 16, flashDecay2: 42, recoilDecayRate: 12,
  },
  lmg: {
    name: 'LMG', damage: 26, fireInterval: 0.095, magSize: 90, reserveMax: 270,
    reloadTime: 3.2, range: 55, spread: 0.028, pellets: 1,
    recoilPerShot: 0.045, recoilMax: 0.16, adsFov: 52, adsSpeed: 0.55,
    muzzleScale: 1.15, flashColor: 0xffcf8a, casingScale: 1.05, casingColor: 0xd8b458,
    muzzleOffset: new THREE.Vector3(0.16, -0.13, -0.84),
    casingOffset: new THREE.Vector3(0.2, -0.13, -0.42),
    camShake: 0.022, flashDecay1: 22, flashDecay2: 55, recoilDecayRate: 7,
  },
};
function makeWeaponState(key) {
  const def = WEAPON_DEFS[key];
  return { ...def, mag: def.magSize, reserve: def.reserveMax, cooldown: 0, reloading: false, reloadT: 0 };
}
const weaponsState = {};
Object.keys(WEAPON_DEFS).forEach((k) => { weaponsState[k] = makeWeaponState(k); });
let currentWeaponKey = 'assault';
let weapon = weaponsState[currentWeaponKey];
// The LMG is heavy enough that it isn't carried and fired on the move like
// every other weapon — equipping it plants the player in place (bipod down,
// the "whole machine gun setup" rather than just a gun in your hands), which
// is both more believable and a natural bipod-steadiness bonus. See its use
// in the movement update and in the fire spread calculation below.
let lmgDeployed = false;

function switchWeapon(key) {
  if (!Input.gameActive || key === currentWeaponKey || !weaponsState[key]) return;
  weapon.reloading = false;
  document.getElementById('reload-hint').classList.remove('show');
  currentWeaponKey = key;
  weapon = weaponsState[key];
  lmgDeployed = (key === 'lmg');
  Object.keys(weaponModels).forEach(k => { weaponModels[k].visible = (k === key); });
  updatePrimitiveArmsVisibility();
  if (realAssaultActions && realAssaultActions.idle) { realAssaultActions.idle.reset().play(); }
  muzzleFlash.position.copy(weapon.muzzleOffset);
  flashMesh.position.copy(weapon.muzzleOffset);
  muzzleGlow.position.copy(weapon.muzzleOffset);
  gunFeel.idleTime = 0; gunFeel.inspectActive = false; gunFeel.inspectT = 0;
  gunFeel.nextInspectDelay = 8 + Math.random() * 6;
  sfxWeaponSwitch();
  updateAmmoHUD();
}

const raycaster = new THREE.Raycaster();
const stats = { shots: 0, hits: 0, kills: 0, startTime: 0 };

function tryShoot() {
  if (!player.alive || player.sprinting || weapon.reloading || weapon.cooldown > 0) return;
  if (weapon.mag <= 0) { startReload(); return; }
  weapon.mag--; weapon.cooldown = weapon.fireInterval;
  stats.shots++;
  player.recoil = Math.min(player.recoil + weapon.recoilPerShot, weapon.recoilMax);
  gunFeel.idleTime = 0; gunFeel.inspectActive = false;
  gunFeel.recoilKickZ = (Math.random() - 0.5) * 0.05;
  gunFeel.fovPunch = Math.max(gunFeel.fovPunch, weapon.camShake * 22);
  screenShake = Math.max(screenShake, weapon.camShake * 26);
  triggerMuzzleFlash();
  ejectCasing();
  spawnMuzzleSmoke();
  sfxGunshot(currentWeaponKey);
  updateAmmoHUD();
  if (REAL_HANDS_WEAPONS.has(currentWeaponKey)) playRigFire();

  const baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.far = weapon.range;

  const ZONE_MULT = { head: 2.0, torso: 1.0, legs: 0.6 };
  const targets = [...envMeshes, ...bots.filter(b => b.alive).flatMap(b => b.hitboxes)];
  let anyBotHit = false, anyHeadshot = false;
  // Bipod steadiness: planted and braced beats held-up-by-arms for a gun this
  // heavy, so the LMG shoots noticeably tighter while deployed.
  const effSpread = lmgDeployed ? weapon.spread * 0.45 : weapon.spread;
  for (let p = 0; p < weapon.pellets; p++) {
    const dir = baseDir.clone();
    dir.x += (Math.random() - 0.5) * effSpread;
    dir.y += (Math.random() - 0.5) * effSpread;
    dir.normalize();
    raycaster.set(origin, dir);
    const hitsArr = raycaster.intersectObjects(targets, false);
    const endPoint = hitsArr.length > 0 ? hitsArr[0].point : origin.clone().addScaledVector(dir, weapon.range);
    spawnTracer(origin, endPoint, weapon.pellets > 1);
    if (hitsArr.length > 0) {
      const hit = hitsArr[0];
      if (hit.object.userData.type === 'bot') {
        const bot = hit.object.userData.botRef;
        const zone = hit.object.userData.zone;
        anyBotHit = true;
        if (zone === 'head') anyHeadshot = true;
        spawnImpact(hit.point, true, null, zone === 'head');
        const dmgDealt = weapon.damage * (ZONE_MULT[zone] || 1);
        bot.takeDamage(dmgDealt, zone, origin.distanceTo(hit.point));
        spawnDamageNumber(hit.point, dmgDealt, zone === 'head', !bot.alive);
      } else {
        spawnImpact(hit.point, false, hit.object.userData.surface);
      }
    }
  }
  if (anyBotHit) { stats.hits++; sfxBotImpact(anyHeadshot, currentWeaponKey); showHitMarker(anyHeadshot); }
}

function startReload() {
  if (weapon.reloading || weapon.reserve <= 0 || weapon.mag === weapon.magSize) return;
  weapon.reloading = true;
  weapon.reloadT = weapon.reloadTime;
  gunFeel.idleTime = 0; gunFeel.inspectActive = false;
  if (REAL_HANDS_WEAPONS.has(currentWeaponKey)) playRigReload(weapon.reloadTime);
  sfxReloadStart(currentWeaponKey);
  document.getElementById('reload-hint').classList.add('show');
}
function finishReload() {
  const needed = weapon.magSize - weapon.mag;
  const take = Math.min(needed, weapon.reserve);
  weapon.mag += take; weapon.reserve -= take;
  weapon.reloading = false;
  sfxReloadDone(currentWeaponKey);
  document.getElementById('reload-hint').classList.remove('show');
  updateAmmoHUD();
}

function triggerMuzzleFlash() {
  muzzleFlash.color.set(weapon.flashColor);
  muzzleFlash.intensity = 3.6;
  flashMesh.material.color.set(weapon.flashColor);
  flashMesh.material.opacity = 1;
  flashMesh.rotation.z = Math.random() * Math.PI * 2;
  flashMesh.scale.setScalar((0.85 + Math.random() * 0.3) * weapon.muzzleScale);
  muzzleGlow.material.color.set(weapon.flashColor);
  muzzleGlow.material.opacity = 0.95;
  const glowScale = (0.16 + Math.random() * 0.05) * weapon.muzzleScale;
  muzzleGlow.scale.set(glowScale, glowScale, 1);
  clearTimeout(triggerMuzzleFlash._t1); clearTimeout(triggerMuzzleFlash._t2);
  triggerMuzzleFlash._t1 = setTimeout(() => {
    muzzleFlash.intensity = 1.1; flashMesh.material.opacity = 0.35; muzzleGlow.material.opacity = 0.4;
  }, weapon.flashDecay1);
  triggerMuzzleFlash._t2 = setTimeout(() => {
    muzzleFlash.intensity = 0; flashMesh.material.opacity = 0; muzzleGlow.material.opacity = 0;
  }, weapon.flashDecay2);
}
function showHitMarker(isHeadshot) {
  const hm = document.getElementById('hitmarker');
  hm.classList.add('show');
  hm.classList.toggle('headshot', !!isHeadshot);
  sfxHitMarker(isHeadshot);
  clearTimeout(showHitMarker._t);
  showHitMarker._t = setTimeout(() => hm.classList.remove('show'), 110);
}

/* ============================================================
   BOTS
   ============================================================ */
const botSpawnPoints = [
  [-10, 0, -10], [10, 0, -12], [-13, 0, 8], [12, 0, 10],
  [-24, 0, 18], [22, 0, -20], [0, 0, -24],
];

const losRaycaster = new THREE.Raycaster();

// Shared bot materials + unit geometries — reused across every bot and every body
// part. Each part is a unit box/cylinder/sphere non-uniformly *scaled* to size, so
// all 5 bots' entire rigs (minus torsoMesh, see note in buildMesh) share just three
// geometry buffers total instead of allocating a fresh one per part per bot.
const botMat = {
  body: new THREE.MeshStandardMaterial({ color: 0xb23a2e, roughness: 0.7 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.85 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.7 }),
  gear: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.65 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xd9855c, roughness: 0.55 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.5, metalness: 0.4 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0x2a2e22, roughness: 0.68 }),
  goggle: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.25, metalness: 0.25 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x33301f, roughness: 0.82 }),
};
const botGeo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  // smooth-shaded (no flatShading), 10 radial segments — reads as genuinely rounded
  // limbs rather than faceted panels once scaled into arms/legs/neck
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  sphere: new THREE.SphereGeometry(1, 12, 10),
};

// Enemy archetypes — built entirely on top of the existing CFG.bot baseline via
// per-instance overrides (this.cfg). The Bot state machine itself is untouched;
// archetypes only change the numbers it already reads (speed/health/range/etc),
// plus a per-bot color tint and scale for visual distinction.
const ARCHETYPES = {
  normal: { label: 'HOSTILE', tint: 0xb23a2e, scale: 1.0, overrides: {} },
  rusher: {
    label: 'RUSHER', tint: 0xff3b30, scale: 0.92,
    overrides: { health: CFG.bot.health * 0.6, speed: CFG.bot.speed * 1.55, attackInterval: CFG.bot.attackInterval * 0.8 },
  },
  heavy: {
    label: 'HEAVY', tint: 0x5a6b46, scale: 1.22,
    overrides: { health: CFG.bot.health * 2.4, speed: CFG.bot.speed * 0.6, damageMin: CFG.bot.damageMin * 1.6, damageMax: CFG.bot.damageMax * 1.6 },
  },
  sniper: {
    label: 'SNIPER', tint: 0x3a5a7a, scale: 1.0,
    overrides: { detectRadius: CFG.bot.detectRadius * 1.6, attackRange: CFG.bot.attackRange * 2.2, speed: CFG.bot.speed * 0.85 },
  },
  elite: {
    label: 'ELITE', tint: 0xd4af37, scale: 1.35,
    overrides: {
      health: CFG.bot.health * 3.5, speed: CFG.bot.speed * 1.1,
      damageMin: CFG.bot.damageMin * 2, damageMax: CFG.bot.damageMax * 2, attackInterval: CFG.bot.attackInterval * 0.75,
    },
  },
};

class Bot {
  constructor(spawn, type) {
    this.spawn = spawn;
    this.bodyMat = botMat.body.clone(); // one clone per bot so archetypes can tint independently
    this.setArchetype(type || 'normal');
    this.group = new THREE.Group();
    this.buildMesh();
    this.reset();
    scene.add(this.group);
  }
  setArchetype(type) {
    this.type = ARCHETYPES[type] ? type : 'normal';
    const def = ARCHETYPES[this.type];
    this.cfg = Object.assign({}, CFG.bot, def.overrides);
    this.bodyMat.color.set(def.tint);
    this.archetypeScale = def.scale;
    this.archetypeLabel = def.label;
    if (this.eliteGlow) this.eliteGlow.visible = this.type === 'elite';
  }
  buildMesh() {
    // Materials and unit geometries are shared module-level (botMat/botGeo, defined
    // once above the class) — every part below scales one of three shared buffers
    // rather than allocating its own, so 5 detailed bots stay cheap.
    const addBox = (parent, mat, x, y, z, sx, sy, sz, ry) => {
      const m = new THREE.Mesh(botGeo.box, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      if (ry) m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };
    const addCyl = (parent, mat, x, y, z, r, h, rz) => {
      const m = new THREE.Mesh(botGeo.cyl, mat);
      m.position.set(x, y, z); m.scale.set(r, h, r);
      if (rz) m.rotation.z = rz;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };
    const addSphere = (parent, mat, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(botGeo.sphere, mat);
      m.position.set(x, y, z); m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };

    // hips (root pivot for the whole body, also used for the death topple) + belt
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    this.group.add(hips);
    addBox(hips, botMat.pants, 0, -0.02, 0, 0.37, 0.22, 0.25);
    addBox(hips, botMat.gear, 0, 0.07, 0, 0.4, 0.07, 0.28);

    // torso pivot (breathing/lean/hit-flinch happens here)
    const torsoPivot = new THREE.Group();
    hips.add(torsoPivot);
    // tapered two-box torso (wider chest, narrower waist) reads far more human than
    // one uniform block. torsoMesh keeps its OWN geometry (not shared) because
    // update() scales it directly for the attack-pulse — a shared unit box would be
    // overwritten to literal size 1 by that relative pulse.
    this.torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.27), this.bodyMat);
    this.torsoMesh.position.set(0, 0.36, 0);
    this.torsoMesh.castShadow = true; this.torsoMesh.receiveShadow = true;
    torsoPivot.add(this.torsoMesh);
    addBox(torsoPivot, this.bodyMat, 0, 0.15, 0, 0.38, 0.22, 0.24); // waist, narrower
    addSphere(torsoPivot, this.bodyMat, 0, 0.28, 0, 0.15, 0.16, 0.14); // chest-waist joint cap, softens the seam
    // tactical vest — front + side plates, four pouches, layered just outside the torso
    addBox(torsoPivot, botMat.vest, 0, 0.33, 0.15, 0.42, 0.34, 0.07);
    addBox(torsoPivot, botMat.vest, -0.26, 0.32, 0.02, 0.06, 0.3, 0.24);
    addBox(torsoPivot, botMat.vest, 0.26, 0.32, 0.02, 0.06, 0.3, 0.24);
    addBox(torsoPivot, botMat.vest, -0.11, 0.2, 0.19, 0.11, 0.1, 0.05);
    addBox(torsoPivot, botMat.vest, 0.11, 0.2, 0.19, 0.11, 0.1, 0.05);
    addBox(torsoPivot, botMat.vest, -0.11, 0.34, 0.19, 0.11, 0.1, 0.05);
    addBox(torsoPivot, botMat.vest, 0.11, 0.34, 0.19, 0.11, 0.1, 0.05);
    // backpack
    addBox(torsoPivot, botMat.gear, 0, 0.25, -0.2, 0.29, 0.38, 0.17);
    // collar — closes the torso-to-neck seam so the uniform reads as one continuous garment
    addCyl(torsoPivot, botMat.gear, 0, 0.49, 0, 0.085, 0.05);

    // neck + head — rounded cylinder neck, slightly egg-shaped head for human proportions
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.53, 0);
    torsoPivot.add(headPivot);
    addCyl(headPivot, botMat.skin, 0, 0.045, 0, 0.065, 0.09);
    addSphere(headPivot, botMat.skin, 0, 0.19, 0, 0.13, 0.15, 0.135);
    // tactical goggles across the eye-line — reads clearly at a distance and hides low-poly face detail
    addBox(headPivot, botMat.goggle, 0, 0.2, 0.11, 0.2, 0.05, 0.08);
    // modern combat helmet — rounded dome (sits slightly back/low, covering more of
    // the head like a real ACH/PASGT), brim, ear protection cups, side rails, NVG mount
    addSphere(headPivot, botMat.helmet, 0, 0.225, -0.01, 0.155, 0.15, 0.16);
    addBox(headPivot, botMat.helmet, 0, 0.155, 0.13, 0.22, 0.03, 0.09);
    addSphere(headPivot, botMat.helmet, -0.15, 0.19, 0, 0.05, 0.055, 0.06);
    addSphere(headPivot, botMat.helmet, 0.15, 0.19, 0, 0.05, 0.055, 0.06);
    addBox(headPivot, botMat.gear, -0.13, 0.16, 0.03, 0.03, 0.14, 0.03);
    addBox(headPivot, botMat.gear, 0.13, 0.16, 0.03, 0.03, 0.14, 0.03);
    addBox(headPivot, botMat.gear, 0, 0.31, 0.09, 0.05, 0.04, 0.06);
    addBox(headPivot, botMat.gear, 0, 0.1, 0.07, 0.15, 0.02, 0.02); // chin strap
    this.headPivot = headPivot;

    // arms — shoulder -> elbow -> hand pivot chain so limbs rotate around real joints.
    // Rounded cylinder upper-arm/forearm with sphere joint-caps at shoulder/elbow for
    // a smooth anatomical silhouette instead of blocky panels. Both arms bend forward
    // into a genuine two-handed rifle-aiming stance.
    const buildArm = (sign) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(sign * 0.27, 0.47, 0);
      torsoPivot.add(shoulder);
      addBox(shoulder, botMat.gear, 0, -0.02, 0, 0.13, 0.1, 0.13); // shoulder pad
      addSphere(shoulder, this.bodyMat, 0, -0.05, 0, 0.075); // shoulder joint cap
      addCyl(shoulder, this.bodyMat, 0, -0.16, 0, 0.068, 0.27); // upper arm, rounded
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.29, 0);
      shoulder.add(elbow);
      addSphere(elbow, botMat.gear, 0, 0, 0, 0.055); // elbow joint cap
      addCyl(elbow, botMat.gear, 0, -0.12, 0, 0.052, 0.23); // forearm sleeve, rounded
      const hand = new THREE.Group();
      hand.position.set(0, -0.24, 0);
      elbow.add(hand);
      addCyl(hand, botMat.gear, 0, 0.02, 0, 0.054, 0.06); // wrist cuff — sleeve meets glove
      addCyl(hand, botMat.glove, 0, -0.05, 0, 0.045, 0.1); // gloved fist, rounded
      addSphere(hand, botMat.glove, 0, -0.1, 0, 0.045); // knuckle cap
      addCyl(hand, botMat.glove, sign * 0.045, -0.03, 0.02, 0.016, 0.07, sign * 0.9); // thumb
      return { shoulder, elbow, hand };
    };
    this.armL = buildArm(-1);
    this.armR = buildArm(1);

    // held weapon prop, parented to the trigger hand
    const gunProp = new THREE.Group();
    addBox(gunProp, botMat.gun, 0, 0, -0.2, 0.08, 0.09, 0.5);
    addBox(gunProp, botMat.gun, 0, -0.14, -0.05, 0.05, 0.16, 0.06);
    gunProp.rotation.x = 0.15;
    gunProp.position.set(0, -0.05, -0.05);
    this.armR.hand.add(gunProp);
    this.gunProp = gunProp;
    // trigger arm (right): raised and bent forward to bring the grip up to chest height
    this.armR.shoulder.rotation.set(1.15, -0.1, 0.12);
    this.armR.elbow.rotation.set(-1.15, 0, 0);
    // support arm (left): reaches further forward to the foregrip
    this.armL.shoulder.rotation.set(1.25, 0.08, -0.32);
    this.armL.elbow.rotation.set(-1.25, 0, 0);

    // legs — hip -> knee -> foot pivot chain. Rounded cylinder thigh/shin with sphere
    // joint-caps at hip/knee, unified pants color, distinct boots with an ankle cuff.
    const buildLeg = (sign) => {
      const hip = new THREE.Group();
      hip.position.set(sign * 0.11, -0.1, 0);
      hips.add(hip);
      addSphere(hip, botMat.pants, 0, 0, 0, 0.085); // hip joint cap
      addCyl(hip, botMat.pants, 0, -0.2, 0, 0.08, 0.4); // thigh, rounded
      const knee = new THREE.Group();
      knee.position.set(0, -0.4, 0);
      hip.add(knee);
      addSphere(knee, botMat.pants, 0, 0, 0, 0.062); // knee joint cap
      addBox(knee, botMat.gear, 0, -0.02, 0.03, 0.09, 0.06, 0.16); // knee pad
      addCyl(knee, botMat.pants, 0, -0.19, 0, 0.065, 0.38); // shin, rounded
      const foot = new THREE.Group();
      foot.position.set(0, -0.38, 0);
      knee.add(foot);
      addBox(foot, botMat.boot, 0, -0.01, 0.01, 0.15, 0.08, 0.17); // ankle cuff
      addBox(foot, botMat.boot, 0, -0.09, 0.05, 0.14, 0.1, 0.24); // boot body
      return { hip, knee, foot };
    };
    this.legL = buildLeg(-1);
    this.legR = buildLeg(1);

    this.hips = hips;
    this.torsoPivot = torsoPivot;

    // invisible zoned hit targets for raycasting — head/torso/legs, each tagged for damage + reaction
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const headHit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), hitMat);
    headHit.position.y = 1.68;
    const torsoHit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.5), hitMat);
    torsoHit.position.y = 1.2;
    const legsHit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.4), hitMat);
    legsHit.position.y = 0.5;
    this.hitboxes = [headHit, torsoHit, legsHit];
    const zones = ['head', 'torso', 'legs'];
    this.hitboxes.forEach((h, i) => { h.userData.type = 'bot'; h.userData.botRef = this; h.userData.zone = zones[i]; this.group.add(h); });
    this.hitMesh = torsoHit; // kept for any legacy single-target reference

    // health bar sprite (simple plane above head, unchanged)
    this.hbCanvas = document.createElement('canvas');
    this.hbCanvas.width = 64; this.hbCanvas.height = 8;
    this.hbTex = new THREE.CanvasTexture(this.hbCanvas);
    const hbMat = new THREE.SpriteMaterial({ map: this.hbTex, depthTest: false });
    this.hbSprite = new THREE.Sprite(hbMat);
    this.hbSprite.scale.set(1.0, 0.14, 1);
    this.hbSprite.position.y = 2.05;
    this.group.add(this.hbSprite);

    // elite indicator — a small gold glow above the health bar, visible only for elites
    this.eliteGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd23a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.eliteGlow.scale.set(0.3, 0.3, 1);
    this.eliteGlow.position.y = 2.22;
    this.eliteGlow.visible = this.type === 'elite';
    this.group.add(this.eliteGlow);
  }
  reset() {
    this.health = this.cfg.health;
    this.maxHealth = this.cfg.health;
    this.alive = true;
    this.state = 'idle';
    this.attackTimer = 0;
    this.deathTimer = 0;
    this.walkT = Math.random() * 10;
    this.breatheT = Math.random() * 10;
    this.flinch = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 1.2 + Math.random() * 1.6;
    this.searchTimer = 0;
    this.lastKnownPos = null;
    this.group.visible = true;
    this.group.scale.set(this.archetypeScale, this.archetypeScale, this.archetypeScale);
    this.group.rotation.set(0, 0, 0);
    this.hips.position.y = 0.95;
    this.legL.hip.rotation.set(0, 0, 0); this.legL.knee.rotation.set(0, 0, 0);
    this.legR.hip.rotation.set(0, 0, 0); this.legR.knee.rotation.set(0, 0, 0);
    this.torsoPivot.rotation.set(0, 0, 0); this.torsoPivot.position.set(0, 0, 0);
    this.gunProp.position.set(0, -0.05, -0.05);
    this.group.position.set(this.spawn[0], 0, this.spawn[2]);
    this.pos = new THREE.Vector3(this.spawn[0], 0, this.spawn[2]);
    this.drawHealthBar();
  }
  drawHealthBar() {
    const ctx = this.hbCanvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = '#000000aa'; ctx.fillRect(0, 0, 64, 8);
    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = pct > 0.4 ? '#e2543a' : '#ff2e2e';
    ctx.fillRect(1, 1, 62 * pct, 6);
    this.hbTex.needsUpdate = true;
  }
  takeDamage(dmg, zone, dist) {
    if (!this.alive) return;
    this.health -= dmg;
    this.drawHealthBar();
    this.flinch = zone === 'head' ? 0.3 : 0.18;
    this.lastHitTime = this.breatheT;
    if (this.health <= 0) this.die(zone, dist);
    else this.state = 'chase';
  }
  die(zone, dist) {
    this.alive = false;
    this.state = 'dead';
    this.deathTimer = this.cfg.respawnDelay;
    sfxBotDeath();
    spawnDustKick(new THREE.Vector3(this.group.position.x, this.group.position.y + 0.1, this.group.position.z));
    spawnImpact(new THREE.Vector3(this.group.position.x, this.group.position.y + 1.1, this.group.position.z), true);
    stats.kills++;
    updateKillHUD();
    awardKill(this, zone === 'head', typeof dist === 'number' && dist > 28);
    addKillFeedEntry(this, zone === 'head');
    spawnPickup(this.group.position);
    WaveManager.killedThisWave++;
    checkWaveClear();
  }
  update(dt) {
    if (!this.alive) {
      this.deathTimer -= dt;
      const fallT = Math.min(1, (1 - this.deathTimer / this.cfg.respawnDelay) * 3);
      this.group.rotation.x = Math.min(Math.PI / 2, fallT * 2.2);
      this.hips.position.y = 0.95 - Math.min(0.9, fallT * 1.1);
      if (this.deathTimer <= 0) {
        if (WaveManager.active && WaveManager.spawnedThisWave < WaveManager.totalThisWave) {
          this.setArchetype(archetypeForSpawn(WaveManager.wave, WaveManager.spawnedThisWave));
          WaveManager.spawnedThisWave++;
          this.reset();
        } else {
          this.group.visible = false;
        }
      }
      return;
    }
    // idle breathing, always running while alive
    this.breatheT += dt;
    this.torsoPivot.position.y = Math.sin(this.breatheT * 2.2) * 0.015;

    // hit-reaction flinch, decays quickly, layered on top of whatever else torso is doing
    let flinchOffset = 0;
    if (this.flinch > 0) {
      this.flinch = Math.max(0, this.flinch - dt);
      flinchOffset = (this.flinch / 0.18) * -0.3;
    }

    const toPlayer = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length();

    if (this.state === 'idle') {
      this.walkT += dt;
      this.group.rotation.y = Math.sin(this.walkT * 0.3) * 0.6;
      this.torsoPivot.rotation.x = flinchOffset;
      if (dist < this.cfg.detectRadius) this.state = 'chase';
    } else if (this.state === 'search') {
      const toTarget = new THREE.Vector3(this.lastKnownPos.x - this.pos.x, 0, this.lastKnownPos.z - this.pos.z);
      const tDist = toTarget.length();
      this.searchTimer -= dt;
      if (dist < this.cfg.detectRadius) { this.state = 'chase'; }
      else if (tDist < 1.2 || this.searchTimer <= 0) { this.state = 'idle'; }
      else {
        toTarget.normalize();
        this.pos.x += toTarget.x * this.cfg.speed * 0.7 * dt;
        this.pos.z += toTarget.z * this.cfg.speed * 0.7 * dt;
        resolveCircleVsBoxes(this.pos, 0.45);
        this.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        this.walkT += dt * 6;
        const swing = Math.sin(this.walkT) * 0.45;
        this.legL.hip.rotation.x = swing; this.legL.knee.rotation.x = Math.max(0, -swing) * 0.8;
        this.legR.hip.rotation.x = -swing; this.legR.knee.rotation.x = Math.max(0, swing) * 0.8;
        this.torsoPivot.rotation.x = 0.05 + flinchOffset;
      }
    } else if (this.state === 'chase') {
      if (dist > this.cfg.detectRadius * 1.6) {
        this.state = 'search';
        this.lastKnownPos = player.pos.clone();
        this.searchTimer = 3 + Math.random() * 2;
      } else {
        if (dist > 0.01) toPlayer.normalize();
        // slight lateral jitter so the approach path isn't a dead-straight line
        const jitter = Math.sin(this.breatheT * 1.7 + this.walkT * 0.3) * 0.25;
        const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        this.pos.x += (toPlayer.x + perp.x * jitter) * this.cfg.speed * dt;
        this.pos.z += (toPlayer.z + perp.z * jitter) * this.cfg.speed * dt;
        resolveCircleVsBoxes(this.pos, 0.45);
        this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        this.walkT += dt * 8;
        const swing = Math.sin(this.walkT) * 0.55;
        this.legL.hip.rotation.x = swing; this.legL.knee.rotation.x = Math.max(0, -swing) * 0.8;
        this.legR.hip.rotation.x = -swing; this.legR.knee.rotation.x = Math.max(0, swing) * 0.8;
        this.torsoPivot.rotation.x = 0.06 + flinchOffset;
        if (dist < this.cfg.attackRange) { this.state = 'attack'; this.attackTimer = this.cfg.attackInterval * 0.4; }
      }
    } else if (this.state === 'attack') {
      this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      this.torsoPivot.rotation.x = flinchOffset;

      // strafe sideways while fighting, flipping direction occasionally for unpredictability;
      // low health biases the bot to open distance rather than press in (a light stand-in for cover-seeking)
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 1.2 + Math.random() * 1.6; }
      const lowHealth = this.health < this.maxHealth * 0.3;
      const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      const radialBias = lowHealth ? -0.35 : (dist < this.cfg.attackRange * 0.55 ? -0.2 : 0);
      const moveX = perp.x * this.strafeDir * 0.65 + (dist > 0.01 ? toPlayer.x / dist : 0) * radialBias;
      const moveZ = perp.z * this.strafeDir * 0.65 + (dist > 0.01 ? toPlayer.z / dist : 0) * radialBias;
      this.pos.x += moveX * this.cfg.speed * 0.6 * dt;
      this.pos.z += moveZ * this.cfg.speed * 0.6 * dt;
      resolveCircleVsBoxes(this.pos, 0.45);
      this.walkT += dt * 6;
      const swing = Math.sin(this.walkT) * 0.35;
      this.legL.hip.rotation.x = swing; this.legL.knee.rotation.x = Math.max(0, -swing) * 0.6;
      this.legR.hip.rotation.x = -swing; this.legR.knee.rotation.x = Math.max(0, swing) * 0.6;

      this.attackTimer -= dt;
      if (dist > this.cfg.attackRange * 1.15) { this.state = 'chase'; }
      else if (this.attackTimer <= 0) {
        // line-of-sight check — bots can't hit the player through solid cover
        const eyeY = getGroundHeight(this.pos.x, this.pos.z) + 1.5;
        const losOrigin = new THREE.Vector3(this.pos.x, eyeY, this.pos.z);
        const losTarget = new THREE.Vector3(player.pos.x, player.pos.y + CFG.eyeHeight, player.pos.z);
        const losDir = losTarget.clone().sub(losOrigin);
        const distToPlayer = losDir.length();
        losDir.normalize();
        losRaycaster.set(losOrigin, losDir);
        losRaycaster.far = Math.max(0.1, distToPlayer - 0.3);
        const blocked = losRaycaster.intersectObjects(envMeshes, false).length > 0;

        if (blocked) {
          this.attackTimer = 0.35; // recheck soon rather than waiting a full cycle behind cover
        } else {
          this.attackTimer = this.cfg.attackInterval;
          const hitChance = Math.max(0.35, Math.min(0.85, 1 - dist / (this.cfg.attackRange * 1.4)));
          if (Math.random() < hitChance && player.alive) {
            const dmg = this.cfg.damageMin + Math.random() * (this.cfg.damageMax - this.cfg.damageMin);
            damagePlayer(dmg);
          }
          this.torsoMesh.scale.set(1.15, 0.9, 1.15);
          this.gunProp.position.z = -0.05 + 0.05;
          setTimeout(() => { this.torsoMesh.scale.set(1, 1, 1); this.gunProp.position.z = -0.05; }, 80);
        }
      }
    }
    this.group.position.set(this.pos.x, getGroundHeight(this.pos.x, this.pos.z), this.pos.z);
  }
}

const bots = botSpawnPoints.slice(0, 5).map(sp => new Bot(sp)); // multiple active enemies

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
  document.getElementById('ammo-count').innerHTML = `${weapon.mag}<span> / ${weapon.reserve}</span>`;
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
function updateXPHud() {
  const need = xpForLevel(save.level);
  const fillEl = document.getElementById('menu-xp-fill');
  const textEl = document.getElementById('menu-xp-text');
  const lvlEl = document.getElementById('menu-level');
  if (fillEl) fillEl.style.width = Math.min(100, (save.xp / need) * 100) + '%';
  if (textEl) textEl.textContent = `${save.xp} / ${need} XP`;
  if (lvlEl) lvlEl.textContent = 'LEVEL ' + save.level;
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
  player.pos.set(0, 0, 6); player.velY = 0;
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

let pendingMapChoice = 'classic';
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('map-picker').classList.remove('hidden');
});
function selectMapChoice(key) {
  pendingMapChoice = key;
  document.getElementById('map-choice-classic').classList.toggle('selected', key === 'classic');
  document.getElementById('map-choice-arctic').classList.toggle('selected', key === 'arctic');
}
document.getElementById('map-choice-classic').addEventListener('click', () => selectMapChoice('classic'));
document.getElementById('map-choice-arctic').addEventListener('click', () => selectMapChoice('arctic'));
document.getElementById('map-choice-cancel').addEventListener('click', () => {
  document.getElementById('map-picker').classList.add('hidden');
});
document.getElementById('map-choice-confirm').addEventListener('click', () => {
  document.getElementById('map-picker').classList.add('hidden');
  activeMapKey = pendingMapChoice;
  const useArctic = activeMapKey === 'arctic';
  // Switch the sky, fog, ambient/direct lighting and palette with the selected theatre.
  if (typeof applyTheme === 'function') applyTheme(useArctic ? 'frostbound' : 'dustline');
  arcticGroup.visible = useArctic;
  // Keep Dustline Canyon intact, but hide its arena dressing when Arctic is selected.
  if (typeof floor !== 'undefined') floor.visible = !useArctic;
  if (typeof haze !== 'undefined') haze.visible = !useArctic;
  if (typeof envMeshes !== 'undefined') envMeshes.forEach(m => { m.visible = !useArctic; });
  if (typeof grassInst !== 'undefined') grassInst.visible = !useArctic;
  if (typeof pebbleInst !== 'undefined') pebbleInst.visible = !useArctic;
  if (typeof shaleInst !== 'undefined') shaleInst.visible = !useArctic;
  // Keep the classic map's atmospheric road/decals out of the snowfield.
  scene.traverse(o => {
    if (o.userData && o.userData.classicOnly) o.visible = !useArctic;
  });
  if (useArctic) {
    document.getElementById('graphics-warning').classList.remove('hidden');
  } else {
    startGame();
  }
});
document.getElementById('graphics-continue').addEventListener('click', () => {
  document.getElementById('graphics-warning').classList.add('hidden');
  startGame();
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

/* ============================================================
   MAIN LOOP
   ============================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (realAssaultMixer) realAssaultMixer.update(dt);

  if (Input.gameActive) {
    if (!isTouch) updateKeyboardMove();

    // look
    const lookYawRaw = Input.yawDelta, lookPitchRaw = Input.pitchDelta;
    yawObject.rotation.y += Input.yawDelta;
    pitchObject.rotation.x += Input.pitchDelta;
    pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitchObject.rotation.x));
    Input.yawDelta = 0; Input.pitchDelta = 0;

    // movement
    const isSprinting = !isTouch && Input.sprintHeld && Input.move.z > 0.3 && !weapon.reloading && player.grounded && !lmgDeployed;
    player.sprinting = isSprinting;
    const speed = CFG.playerSpeed * (isSprinting ? 1.55 : 1);
    const forward = new THREE.Vector3(-Math.sin(yawObject.rotation.y), 0, -Math.cos(yawObject.rotation.y));
    const right = new THREE.Vector3(Math.sin(yawObject.rotation.y + Math.PI / 2), 0, Math.cos(yawObject.rotation.y + Math.PI / 2));
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, Input.move.z);
    moveDir.addScaledVector(right, Input.move.x);
    if (moveDir.lengthSq() > 0) moveDir.normalize();
    // Bipod's down — the LMG is set up in place, not carried, so WASD stops
    // repositioning the player entirely while it's equipped (look/aim still
    // free). moveDir.lengthSq() reading 0 from here on also naturally turns
    // off the view-bob and footstep sounds below, for free.
    if (lmgDeployed) moveDir.set(0, 0, 0);

    player.pos.x += moveDir.x * speed * dt;
    player.pos.z += moveDir.z * speed * dt;
    resolveCircleVsBoxes(player.pos, CFG.playerRadius);

    // gravity / jump
    const wasGrounded = player.grounded;
    if (Input.jumpQueued && player.grounded && !lmgDeployed) { player.velY = CFG.jumpSpeed; player.grounded = false; sfxJump(); }
    Input.jumpQueued = false;
    player.velY += CFG.gravity * dt;
    player.pos.y += player.velY * dt;
    const groundH = getGroundHeight(player.pos.x, player.pos.z);
    if (player.pos.y <= groundH) {
      const fallSpeed = -player.velY;
      player.pos.y = groundH; player.velY = 0; player.grounded = true;
      if (!wasGrounded) { sfxLand(); gunFeel.landCompress = Math.min(0.18, Math.max(0, fallSpeed) * 0.018); }
    }

    // view bob
    const moving = moveDir.lengthSq() > 0 && player.grounded;
    player.bobT += (moving ? dt * (isSprinting ? 13 : 9) : dt * 4);
    const bobAmt = moving ? Math.sin(player.bobT) * (isSprinting ? 0.075 : 0.045) : Math.sin(player.bobT) * 0.01;
    if (moving) {
      const bobSign = Math.sign(Math.sin(player.bobT));
      if (bobSign !== 0 && bobSign !== player.footstepSign) { player.footstepSign = bobSign; sfxFootstep(); }
    }

    gunFeel.landCompress *= Math.max(0, 1 - dt * 10);
    // Settle slightly lower when the LMG is deployed — braced/crouched behind
    // the gun rather than standing tall holding it, the visual half of
    // "planted in place" alongside the movement lock above.
    const deployedDip = lmgDeployed ? 0.12 : 0;
    yawObject.position.set(player.pos.x, player.pos.y + CFG.eyeHeight + bobAmt - gunFeel.landCompress - deployedDip, player.pos.z);

    // recoil recovery
    player.recoil *= Math.max(0, 1 - dt * weapon.recoilDecayRate);
    gunFeel.recoilKickZ *= Math.max(0, 1 - dt * 10);
    pitchObject.rotation.x += player.recoil * 0.0; // recoil visually handled via fov/gun kick below

    // weapon sway — gun lags behind look movement and strafing for a handheld feel
    const swayTargetYaw = -lookYawRaw * 14;
    const swayTargetPitch = lookPitchRaw * 14;
    gunFeel.swayYaw += (swayTargetYaw - gunFeel.swayYaw) * Math.min(1, dt * 9);
    gunFeel.swayPitch += (swayTargetPitch - gunFeel.swayPitch) * Math.min(1, dt * 9);
    const strafeTarget = Input.move.x * 0.035;
    gunFeel.strafeTilt += (strafeTarget - gunFeel.strafeTilt) * Math.min(1, dt * 6);
    gunFeel.sprintLower += ((isSprinting ? 1 : 0) - gunFeel.sprintLower) * Math.min(1, dt * 8);

    // reload dip — simple down-and-back animation while reloading, plus per-weapon part motion
    let reloadDip = 0, reloadTwist = 0, magDrop = 0, pumpSlide = 0, boltSlide = 0;
    if (weapon.reloading) {
      const rp = Math.min(1, Math.max(0, 1 - weapon.reloadT / weapon.reloadTime));
      const curve = Math.sin(rp * Math.PI);
      reloadDip = curve * 0.11;
      reloadTwist = curve * 0.5;
      magDrop = curve * 0.24;
      pumpSlide = rp < 0.88 ? Math.sin((rp / 0.88) * Math.PI * 2) * 0.055 : 0;
      boltSlide = curve * 0.05;
    }
    const activeWeaponModel = weaponModels[currentWeaponKey];
    if (activeWeaponModel.magPart) activeWeaponModel.magPart.position.y = activeWeaponModel.magBaseY - magDrop;
    if (activeWeaponModel.pumpPart) activeWeaponModel.pumpPart.position.z = activeWeaponModel.pumpBaseZ + pumpSlide;
    if (activeWeaponModel.boltPart) activeWeaponModel.boltPart.position.x = activeWeaponModel.boltBaseX + boltSlide;

    // idle breathing sway + occasional weapon-check inspect — purely cosmetic,
    // fades out the instant the player moves, looks around, shoots, ADS's or
    // reloads, and never touches camera rotation or the raycast origin.
    gunFeel.breatheT += dt;
    const idleCalm = (!moving && !isSprinting && !Input.adsHeld && !weapon.reloading && player.grounded);
    const inputActive = moving || isSprinting || Input.shootHeld || Input.adsHeld || weapon.reloading
      || Math.abs(lookYawRaw) > 0.0006 || Math.abs(lookPitchRaw) > 0.0006;
    if (inputActive) { gunFeel.idleTime = 0; gunFeel.inspectActive = false; }
    else gunFeel.idleTime += dt;
    if (!gunFeel.inspectActive && player.alive && idleCalm && gunFeel.idleTime > gunFeel.nextInspectDelay) {
      gunFeel.inspectActive = true; gunFeel.inspectT = 0;
    }
    if (gunFeel.inspectActive) {
      gunFeel.inspectT += dt;
      if (gunFeel.inspectT >= gunFeel.inspectDuration) {
        gunFeel.inspectActive = false; gunFeel.idleTime = 0;
        gunFeel.nextInspectDelay = 10 + Math.random() * 8;
      }
    }
    gunFeel.inspectBlend += ((gunFeel.inspectActive ? 1 : 0) - gunFeel.inspectBlend) * Math.min(1, dt * 7);

    const breatheFade = (Input.adsHeld ? 0 : 1) * (1 - gunFeel.sprintLower) * (1 - gunFeel.inspectBlend * 0.7);
    const breatheX = Math.sin(gunFeel.breatheT * 1.3) * 0.0035 * breatheFade;
    const breatheY = Math.sin(gunFeel.breatheT * 0.85 + 1.1) * 0.002 * breatheFade;
    const breatheRX = Math.sin(gunFeel.breatheT * 1.05 + 0.4) * 0.009 * breatheFade;
    const breatheRY = Math.sin(gunFeel.breatheT * 0.7) * 0.006 * breatheFade;

    let inspX = 0, inspY = 0, inspZ = 0, inspRX = 0, inspRY = 0, inspRZ = 0;
    if (gunFeel.inspectBlend > 0.001) {
      const ip = Math.min(1, gunFeel.inspectT / gunFeel.inspectDuration);
      const curve = Math.sin(ip * Math.PI) * gunFeel.inspectBlend;
      inspRX = -0.14 * curve; inspRY = 0.22 * curve; inspRZ = 0.06 * curve;
      inspY = 0.018 * curve; inspZ = 0.035 * curve; inspX = -0.01 * curve;
    }

    // gun sway + recoil kick + reload dip + sprint lower + breathing + inspect, combined
    gunGroup.position.x = gunFeel.swayYaw * 0.012 + breatheX + inspX;
    gunGroup.position.y = -0.02 + Math.sin(player.bobT) * 0.008 + player.recoil * 0.3 - reloadDip - gunFeel.sprintLower * 0.1 + breatheY + inspY;
    gunGroup.position.z = -0.02 * Math.sin(player.bobT * 0.5) + gunFeel.swayPitch * 0.01 - gunFeel.sprintLower * 0.05 + inspZ;
    gunGroup.rotation.x = -player.recoil * 1.6 + gunFeel.swayPitch * 0.06 + reloadTwist + gunFeel.sprintLower * 0.4 + breatheRX + inspRX;
    gunGroup.rotation.y = gunFeel.swayYaw * 0.06 + gunFeel.sprintLower * 0.15 + breatheRY + inspRY;
    gunGroup.rotation.z = gunFeel.strafeTilt + gunFeel.recoilKickZ - reloadTwist * 0.5 + inspRZ;

    // ADS — disabled while sprinting. weapon.adsSpeed (SMG faster, LMG slower) scales
    // how quickly the zoom/reticle arrive; weapons that don't set it default to 1, so
    // the assault/shotgun/sniper feel is unchanged.
    const adsSpeedMult = weapon.adsSpeed || 1;
    const targetFov = (Input.adsHeld && !isTouch && !isSprinting) ? weapon.adsFov : baseFov;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10 * adsSpeedMult);
    camera.fov += gunFeel.fovPunch;
    gunFeel.fovPunch *= Math.max(0, 1 - dt * 14);
    camera.updateProjectionMatrix();

    // ADS reticle/scope overlay — same blend speed as the FOV lerp above so the
    // reticle and the zoom arrive together. Only the current weapon's reticle shows.
    // SMG/LMG reuse the assault rifle's red-dot (both are iron-sight/red-dot guns,
    // not scoped), rather than adding two more DOM reticle elements.
    const adsTarget = (Input.adsHeld && !isTouch && !isSprinting) ? 1 : 0;
    adsBlend += (adsTarget - adsBlend) * Math.min(1, dt * 10 * adsSpeedMult);
    reddotEl.style.opacity = (currentWeaponKey === 'assault' || currentWeaponKey === 'smg' || currentWeaponKey === 'lmg') ? adsBlend : 0;
    shotgunSightEl.style.opacity = currentWeaponKey === 'shotgun' ? adsBlend : 0;
    scopeEl.style.opacity = currentWeaponKey === 'sniper' ? adsBlend : 0;
    crosshairEl.style.opacity = 1 - adsBlend;

    // shooting
    if (Input.shootHeld) tryShoot();
    weapon.cooldown = Math.max(0, weapon.cooldown - dt);
    if (Input.reloadQueued) { startReload(); Input.reloadQueued = false; }
    if (weapon.reloading) {
      weapon.reloadT -= dt;
      if (weapon.reloadT <= 0) finishReload();
    }

    // bots
    bots.forEach(b => b.update(dt));

    // weapon-feel particle pools
    updateCasings(dt);
    updateImpacts(dt);
    updateTracers(dt);
    updateSmoke(dt);
    updateDust(dt);
    updateAmbientSmoke(dt);
    updateDustKick(dt);
    updateRain(dt);
    updateLightning(dt);
    updatePickups(dt);
    updateDamageNumbers(dt);
    updateKillFeed(dt);
    updateMinimap();

    // screen shake — CSS transform on the canvas element only, capped to stay subtle
    screenShake *= Math.max(0, 1 - dt * 18);
    if (screenShake > 0.0005) {
      const sx = (Math.random() - 0.5) * Math.min(6, screenShake * 60);
      const sy = (Math.random() - 0.5) * Math.min(6, screenShake * 60);
      const sr = (Math.random() - 0.5) * Math.min(0.35, screenShake * 3);
      canvasEl.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) rotate(${sr.toFixed(3)}deg)`;
    } else if (canvasEl.style.transform) {
      canvasEl.style.transform = '';
    }
  }

  renderer.render(scene, camera);
}

updateHealthHUD();
updateAmmoHUD();
animate();
