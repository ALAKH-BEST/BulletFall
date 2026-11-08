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
// Combat Knife — purely procedural (no fetched asset, by design — real-hardware GPU/texture
// budget regressions have hit this project three times already with real env props, so the
// one weapon with zero download risk stays hand-built): a steel blade, a guard, and a
// wrapped handle, held low and forward like a drawn knife rather than slung like a gun.
{
  const g = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc7ccd1, roughness: 0.25, metalness: 0.9 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.8, metalness: 0.05 });
  const guardMat = gunMat;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.28), bladeMat);
  blade.position.set(0.14, -0.15, -0.55);
  // simple tapered tip, approximated as a thin wedge via a scaled cone
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.06, 4), bladeMat);
  tip.rotation.x = -Math.PI / 2;
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(1, 1, 0.5);
  tip.position.set(0.14, -0.15, -0.72);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.018), guardMat);
  guard.position.set(0.14, -0.15, -0.4);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8), handleMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.14, -0.15, -0.3);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), guardMat);
  pommel.position.set(0.14, -0.15, -0.21);
  g.add(blade, tip, guard, handle, pommel);
  g.visible = false;
  gunGroup.add(g);
  weaponModels.knife = g;
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

