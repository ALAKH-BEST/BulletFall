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
  knife: {
    name: 'Combat Knife', damage: 55, fireInterval: 0.42, magSize: 0, reserveMax: 0,
    reloadTime: 0, range: 2.4, spread: 0, pellets: 1, melee: true,
    recoilPerShot: 0, recoilMax: 0, adsFov: 45,
    muzzleScale: 1.0, flashColor: 0xffcf8a, casingScale: 1.0, casingColor: 0xd8b458,
    muzzleOffset: new THREE.Vector3(0.16, -0.12, -0.5),
    casingOffset: new THREE.Vector3(0.2, -0.12, -0.3),
    camShake: 0, flashDecay1: 20, flashDecay2: 50, recoilDecayRate: 10,
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
const ZONE_MULT = { head: 2.0, torso: 1.0, legs: 0.6 };

// Knife swing — a short, self-contained timer (not tied into gunFeel's idle/inspect/sway
// system) driving a quick forward-and-back slash kick applied to gunGroup only while the
// knife is equipped. Purely cosmetic, same as every other gunFeel offset.
let knifeSwingActive = false;
let knifeSwingTimer = 0;
const KNIFE_SWING_DURATION = 0.22;

function tryShoot() {
  if (!player.alive || player.sprinting || weapon.reloading || weapon.cooldown > 0) return;
  if (weapon.melee) { tryMeleeAttack(); return; }
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

// Melee attack — a short-range single raycast instead of ranged ballistics: no mag/reserve,
// no muzzle flash, no casing eject, no tracer. Swings aren't counted into stats.shots/hits
// (the "accuracy" stat downstream is meant to read as gunplay accuracy, and folding a
// close-range melee raycast into it would make that number misleading either way).
function tryMeleeAttack() {
  weapon.cooldown = weapon.fireInterval;
  gunFeel.idleTime = 0; gunFeel.inspectActive = false;
  knifeSwingActive = true; knifeSwingTimer = 0;
  sfxKnifeSwing();

  const baseDir = new THREE.Vector3();
  camera.getWorldDirection(baseDir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.far = weapon.range;
  raycaster.set(origin, baseDir);

  const targets = [...envMeshes, ...bots.filter(b => b.alive).flatMap(b => b.hitboxes)];
  const hitsArr = raycaster.intersectObjects(targets, false);
  if (hitsArr.length > 0) {
    const hit = hitsArr[0];
    if (hit.object.userData.type === 'bot') {
      const bot = hit.object.userData.botRef;
      const zone = hit.object.userData.zone;
      const isHeadshot = zone === 'head';
      spawnImpact(hit.point, true, null, isHeadshot);
      const dmgDealt = weapon.damage * (ZONE_MULT[zone] || 1);
      bot.takeDamage(dmgDealt, zone, origin.distanceTo(hit.point));
      spawnDamageNumber(hit.point, dmgDealt, isHeadshot, !bot.alive);
      sfxBotImpact(isHeadshot, currentWeaponKey);
      showHitMarker(isHeadshot);
    } else {
      spawnImpact(hit.point, false, hit.object.userData.surface);
    }
  }
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

