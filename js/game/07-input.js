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
  if (e.code === 'Digit6') switchWeapon('knife');
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
const weaponCycle = ['assault', 'smg', 'shotgun', 'sniper', 'lmg', 'knife'];
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

