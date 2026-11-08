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

