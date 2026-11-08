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
  // The Abandoned Street map gets its own play boundary, sized to actually
  // match its model's real footprint (see loadStreetModel) plus a small
  // margin — not an arbitrary blown-up arena. See resolveCircleVsBoxes,
  // which picks between this and arenaHalf based on the active map.
  streetArenaHalf: 100,
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
  street: {
    name: 'Abandoned Street',
    swatch: ['#8a9bb0', '#4a5568', '#1c2230'],
    sky: { top: 0x1c2230, mid: 0x3d4a63, bottom: 0x7a8aa0 },
    fog: { color: 0x2a3140, density: 0.014 },
    sun: { light: 0xcdd8e8, disc: 0xe8eef5 },
    hemi: { sky: 0x8a9bb0, ground: 0x1c2018 },
    fill: 0x5f7fa8,
    wall: 0x3a4250,
    floor: { base: '#5a6270', patchA: '#454c58', patchB: '#6e7684', speckleDark: 'rgba(20,22,28,', speckleLight: 'rgba(160,168,180,', seam: 'rgba(15,17,22,0.25)', crack: 'rgba(10,12,16,0.4)' },
    crate1: { base: '#5a4a3a', band: '#2a2018' },
    crate2: { base: '#3f5560', band: '#1a2a30' },
    rockTint: 0x8a92a0,
    grass: 0x4a5240,
    exposure: 1.0, hemiIntensity: 0.6, sunIntensity: 1.0,
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


// Declared here, with the XP code it belongs to, because the weather script calls it while loading.
function updateXPHud() {
  const need = xpForLevel(save.level);
  const fillEl = document.getElementById('menu-xp-fill');
  const textEl = document.getElementById('menu-xp-text');
  const lvlEl = document.getElementById('menu-level');
  if (fillEl) fillEl.style.width = Math.min(100, (save.xp / need) * 100) + '%';
  if (textEl) textEl.textContent = `${save.xp} / ${need} XP`;
  if (lvlEl) lvlEl.textContent = 'LEVEL ' + save.level;
}
