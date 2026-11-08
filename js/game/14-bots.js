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

