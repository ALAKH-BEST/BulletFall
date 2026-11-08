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

    // Knife swing kick — a quick forward-and-back slash, additive on top of the sway/recoil
    // pose above, only while the knife is the equipped weapon.
    if (knifeSwingActive) {
      knifeSwingTimer += dt;
      if (knifeSwingTimer >= KNIFE_SWING_DURATION) { knifeSwingActive = false; knifeSwingTimer = 0; }
    }
    if (currentWeaponKey === 'knife') {
      const swingAmt = knifeSwingActive ? Math.sin((knifeSwingTimer / KNIFE_SWING_DURATION) * Math.PI) : 0;
      gunGroup.rotation.x -= swingAmt * 0.55;
      gunGroup.rotation.y += swingAmt * 0.4;
      gunGroup.position.z -= swingAmt * 0.14;
    }

    // ADS — disabled while sprinting, and the knife never aims down sights.
    // weapon.adsSpeed (SMG faster, LMG slower) scales how quickly the zoom/reticle
    // arrive; weapons that don't set it default to 1, so the assault/shotgun/sniper
    // feel is unchanged.
    const adsSpeedMult = weapon.adsSpeed || 1;
    const targetFov = (Input.adsHeld && !isTouch && !isSprinting && !weapon.melee) ? weapon.adsFov : baseFov;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10 * adsSpeedMult);
    camera.fov += gunFeel.fovPunch;
    gunFeel.fovPunch *= Math.max(0, 1 - dt * 14);
    camera.updateProjectionMatrix();

    // ADS reticle/scope overlay — same blend speed as the FOV lerp above so the
    // reticle and the zoom arrive together. Only the current weapon's reticle shows.
    // SMG/LMG reuse the assault rifle's red-dot (both are iron-sight/red-dot guns,
    // not scoped), rather than adding two more DOM reticle elements.
    const adsTarget = (Input.adsHeld && !isTouch && !isSprinting && !weapon.melee) ? 1 : 0;
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
