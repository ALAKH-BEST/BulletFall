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
function sfxKnifeSwing() {
  // A quick air-whoosh — bandpass-filtered noise with a fast pitch sweep, nothing
  // tonal/musical, same filtered-noise-only approach as the rest of the weapon sfx.
  if (!audioCtx || audioMuted) return;
  playNoise({ duration: 0.09, filterType: 'bandpass', freq: 900, Q: 0.6, gain: 0.22, decay: 0.08 });
  setTimeout(() => {
    playNoise({ duration: 0.05, filterType: 'bandpass', freq: 500, Q: 0.7, gain: 0.14, decay: 0.045 });
  }, 40);
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

