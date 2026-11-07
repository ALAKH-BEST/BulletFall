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
  return fetchArrayBufferWithProgress('assets/ak47.glb')
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
// Barrier/sandbag stay DISABLED (see the commented-out chain below) after
// the full 4-asset chain caused a real-hardware regression (the AK47 and
// even the procedural crates disappeared — see that commit's message).
// Boulders were re-enabled first, alone, as an isolated ~5MB step and
// confirmed working on the reporter's device (AK47 + stones loading fine).
// Bringing the shipping container back next, still one asset at a time —
// if THIS breaks it, the container specifically is implicated; if not,
// barrier and sandbag can go back one at a time the same way.
// Captured so the deployment loading screen (see beginDeployment() near the
// map picker UI wiring) can wait on this chain actually settling instead of
// just hoping it's done by the time the player reaches gameplay.
const mainAssetsPromise = loadRealAssaultModel().then(() => {
  return loadRealBoulders(['assets/boulder_real.glb', 'assets/boulder_real2.glb'], rockSwapCutoff);
}).then(() => {
  return loadRealEnvProp('assets/shipping_container.glb', [
    { x: -7, z: 6, ry: 0 },
    { x: -5, z: -5, ry: 0.35 },
    { x: 0, z: 10, ry: -0.2 },
    { x: -22, z: -14, ry: 1.0 },
  ], { scale: 0.0065, surface: 'metal' });
});
// Next candidates, once the container above is confirmed safe — chain
// these onto the container's .then() above, one at a time, the same way:
// loadRealEnvProp('assets/concrete_barrier.glb', [
//   { x: -4.6, z: -20, ry: Math.PI / 2 },
//   { x: 4.6, z: -12, ry: Math.PI / 2 },
//   { x: -4.6, z: -2, ry: Math.PI / 2 },
//   { x: 4.6, z: 6, ry: Math.PI / 2 },
//   { x: -4.6, z: 14, ry: Math.PI / 2 },
// ], { scale: 0.0095, surface: 'rock' });
// loadRealEnvProp('assets/sandbag_wall.glb', [
//   { x: -19, z: -19, ry: 0.9 },
//   { x: -27, z: -16, ry: 0.15 },
// ], { scale: 0.01524, surface: 'wood', skipCollider: true });
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

