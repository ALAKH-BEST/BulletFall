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

// Oriented variant — a box collider that isn't aligned to the world X/Z
// axes, rotated `rot` radians (yaw) around its center. Needed for pieces
// placed at an angle (diagonal collapsed debris panels, rotated wall
// segments): an axis-aligned Box3 around a 45°-rotated square is up to
// sqrt(2) bigger than the piece's real footprint on each side, which reads
// in-game as an invisible wall blocking the player well before they
// actually reach the visible geometry. (cx, cz) is the box's world-space
// center and (hx, hz) are its HALF-extents in its own local, unrotated
// frame (i.e. before `rot` is applied) — not world-space AABB half-sizes.
function addRotatedCollider(cx, cz, hx, hz, rot, map = 'classic') {
  collidables.push({ cx, cz, hx, hz, rot, map });
}

// Floor — subdivided into a grid and displaced with gentle low-poly noise for real
// terrain relief (slopes/dips/rock variation). This is a VISUAL-ONLY heightfield: the
// player/bot ground-snap logic still uses getGroundHeight() (flat 0, except PERCH), so
// the noise amplitude is kept small and is explicitly flattened over the PERCH ramp/
// platform, the central road, and the spawn point to avoid any visible mismatch with
// the collision the game actually simulates. One mesh, one draw call, same as before.
// Map selection state and the Street-only scene group must exist before terrain textures are built.
const streetGroup = new THREE.Group();
scene.add(streetGroup);
streetGroup.visible = false;
let activeMapKey = 'classic';
const classicEnvironmentObjects = [];
// World-space Z of the street model's center once loaded/positioned by
// loadStreetModel() — a fixed design constant (not computed at runtime)
// so the shared sun light can be re-targeted onto it (see the map-picker
// confirm handler) even before the model has actually loaded.
const STREET_MODEL_CENTER_Z = 0;
// World-space spawn point for the Abandoned Street map — a real open gap
// inside the model's own interior courtyard (found from the generated
// collider field, with a few units of clearance to the nearest wall on
// every side), so the player starts inside the street block instead of
// approaching it from open ground outside. See startGame().
const STREET_SPAWN = { x: -2, z: 0 };

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
// Continuous grime overlay for the Abandoned Street map's ground: dark
// weathered asphalt with scattered oil stains and grime streaks (this map's
// equivalent of the classic map's bare sand — a distinct ground read, not
// just a palette swap). The uploaded street model brings its own road/
// sidewalk meshes for the area it actually covers, but the player's full
// movement area is bigger than that footprint, so this still ground the
// street model sits on and stops the player from seeing void past its edges.
{
  const c=document.createElement('canvas'); c.width=1024; c.height=1024;
  const ctx=c.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1024,1024);
  grad.addColorStop(0,'#363a40'); grad.addColorStop(.48,'#2a2d32'); grad.addColorStop(1,'#201f24');
  ctx.fillStyle=grad; ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<70;i++){
    const x=Math.random()*1024,y=Math.random()*1024,r=14+Math.random()*60;
    const oil=Math.random()>.55;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,oil?'rgba(10,12,16,.3)':'rgba(40,46,56,.22)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  for(let i=0;i<22000;i++){
    const v=Math.random()>.52?70:20, a=.025+Math.random()*.045;
    ctx.fillStyle=`rgba(${v},${v},${v},${a})`;
    ctx.fillRect(Math.random()*1024,Math.random()*1024,1+Math.random()*2,1+Math.random()*2);
  }
  const grimeTex=new THREE.CanvasTexture(c);
  grimeTex.wrapS=grimeTex.wrapT=THREE.RepeatWrapping;
  // Sized to cover the whole street map's play boundary (CFG.streetArenaHalf),
  // with a little margin, so the ground never visibly runs out under the
  // player no matter where in the movement area they walk.
  const STREET_GROUND_SPAN = (CFG.streetArenaHalf + 4) * 2;
  // Keep the same texel density as the original 72-unit-wide plane instead of
  // stretching one 2x2 tiling across this bigger ground.
  const grimeRepeat = 2 * STREET_GROUND_SPAN / 72;
  grimeTex.repeat.set(grimeRepeat, grimeRepeat);
  const grimeMesh=new THREE.Mesh(new THREE.PlaneGeometry(STREET_GROUND_SPAN,STREET_GROUND_SPAN),
    new THREE.MeshStandardMaterial({map:grimeTex,color:0xffffff,roughness:.92,metalness:.04,envMapIntensity:.25,transparent:true,opacity:.82}));
  grimeMesh.rotation.x=-Math.PI/2;grimeMesh.position.y=.04;grimeMesh.receiveShadow=true;
  streetGroup.add(grimeMesh);
}


function buildSandTexture(theme) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const f = theme.floor;

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


// ABANDONED STREET MAP LAYER — a real scanned/modeled street block, with
// nothing else hand-placed in it: no carried-over crates, barriers or
// rubble from the other maps' dressing. Everything the player sees and
// collides with here — street, buildings, props — comes from the uploaded
// model itself (see loadStreetModel below), plus the plain ground plane
// above so the player's movement area doesn't run out of ground past the
// model's own footprint. The model is loaded on demand the first time a
// player picks this map in the battlefield picker, not fetched eagerly at
// startup — it's the heaviest real asset in this project (~13MB), and this
// project has hit real-hardware GPU/texture-memory regressions from
// stacking real assets more than once, so it stays opt-in.
//
// Lighting for this map reuses the shared scene sun/hemi/fill lights
// (reskinned to the 'street' theme by applyTheme), re-targeted to the
// street model's center — see the sun-retargeting code in the map-picker
// confirm handler below — rather than a second, separate light rig.

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

// Approximate on-disk sizes (bytes) of the real assets fetched at startup or
// on map selection — used only to weight the deployment loading screen's
// progress bar so files of very different sizes (the AK47 alone is ~5x a
// boulder) fill it proportionally instead of jumping unevenly. Not
// load-bearing: if a file's actual size ever drifts from this, the response's
// own Content-Length header is preferred when present, and the bar is just
// slightly uneven if neither is available — nothing breaks.
const ASSET_SIZES = {
  'assets/ak47.glb': 13804592,
  'assets/boulder_real.glb': 2609956,
  'assets/boulder_real2.glb': 2384680,
  'assets/shipping_container.glb': 5627592,
  'assets/abandoned_city_street.glb': 13666076,
};

// Tracks download progress (0..1 per URL) across every real asset fetched
// through fetchArrayBufferWithProgress below, independent of which loader
// function is doing the fetching. The deployment loading screen subscribes
// to this to drive its progress bar — see beginDeployment() near the map
// picker UI wiring.
const AssetLoadTracker = {
  progress: {},
  listeners: [],
  report(url, loaded, total) {
    const denom = total || ASSET_SIZES[url] || loaded || 1;
    this.progress[url] = Math.max(0, Math.min(1, loaded / denom));
    this.listeners.forEach((fn) => fn());
  },
  // Average progress across just the given URLs (the ones relevant to the
  // map currently being deployed into) — any other in-flight fetch doesn't
  // affect it. URLs not yet reported at all count as 0 progress.
  overallFor(urls) {
    if (!urls.length) return 1;
    const sum = urls.reduce((s, u) => s + (this.progress[u] || 0), 0);
    return sum / urls.length;
  },
  onChange(fn) { this.listeners.push(fn); },
};

// Streams a fetch response via its reader instead of awaiting arrayBuffer()
// directly, purely so AssetLoadTracker can report real incremental progress
// as bytes arrive — the resolved value is the same ArrayBuffer either way,
// so every existing caller (loadRealEnvProp, loadBoulderTemplate,
// loadRealAssaultModel, loadStreetModel) is a drop-in swap with no other
// change in behavior. Falls back to a plain arrayBuffer() read (progress
// just jumps straight to 100% for that file) if the body can't be streamed
// or no length is known at all.
function fetchArrayBufferWithProgress(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = parseInt(res.headers.get('Content-Length') || '0', 10) || ASSET_SIZES[url] || 0;
    if (!res.body || typeof res.body.getReader !== 'function') {
      return res.arrayBuffer().then((buf) => {
        AssetLoadTracker.report(url, buf.byteLength, total || buf.byteLength);
        return buf;
      });
    }
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) {
        const out = new Uint8Array(received);
        let offset = 0;
        chunks.forEach((c) => { out.set(c, offset); offset += c.length; });
        AssetLoadTracker.report(url, received, total || received);
        return out.buffer;
      }
      chunks.push(value);
      received += value.length;
      AssetLoadTracker.report(url, received, total);
      return pump();
    });
    return pump();
  });
}

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
  return fetchArrayBufferWithProgress(url)
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
            // These real-asset swaps load asynchronously and can finish
            // after the player has already picked a map — set the initial
            // visibility to match whichever map is active right now rather
            // than always starting visible (the Abandoned Street map should
            // have nothing pre-existing in it, classic env props included).
            // The confirm handler's envMeshes toggle takes over from here.
            child.visible = activeMapKey !== 'street';
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

// Street Outpost — a small, fully enterable room, built procedurally (same
// approach as the classic map's crates/walls, not a fetched asset). The real
// "Abandoned City Street" model below is an exterior-facade kit: its window
// and door openings are all shallow 1-2 unit pockets backed by solid
// geometry, not real rooms (confirmed by flying a camera through several of
// them) — there is nothing to actually walk into anywhere in that model. So
// rather than fake an "enter a building" feeling with more facade, this is a
// real room with real depth: four walls with a true doorway gap (no
// collider across the opening), a floor, a roof, and an interior light —
// placed off to the side of the main street model, in open ground, so it
// doesn't collide with or get swallowed by it.
function buildStreetOutpost(cx, cz) {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  streetGroup.add(group);

  const hx = 5, hz = 4;      // half-extents of the room's exterior footprint
  const wallHt = 4.2;         // tall enough to clear CFG.eyeHeight (1.65) with real headroom
  const t = 0.4;               // wall thickness
  const doorW = 2.4;           // doorway gap, centered on the south wall

  function wallMesh(w, d, lx, lz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallHt, d), wallMat);
    m.position.set(lx, wallHt / 2, lz);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.type = 'env'; m.userData.surface = 'rock';
    group.add(m);
    addCollider(cx + lx - w / 2, cz + lz - d / 2, cx + lx + w / 2, cz + lz + d / 2, 'street');
  }
  // South wall, split around the doorway.
  wallMesh(hx - doorW / 2, t, -(hx + doorW / 2) / 2, -hz);
  wallMesh(hx - doorW / 2, t, (hx + doorW / 2) / 2, -hz);
  // North, west, east walls — solid.
  wallMesh(hx * 2, t, 0, hz);
  wallMesh(t, hz * 2, -hx, 0);
  wallMesh(t, hz * 2, hx, 0);

  // Floor — a distinct, slightly raised slab so the room reads as its own
  // interior space rather than just more street ground.
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2 - t, hz * 2 - t),
    new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9, metalness: 0.05 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0.03, 0);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Roof — visual cap only (no collider: there's no way up to it, and
  // nothing in this game climbs), kept just above wall height.
  const roofMesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2 + t, 0.3, hz * 2 + t),
    wallMat
  );
  roofMesh.position.set(0, wallHt + 0.15, 0);
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // Warm interior light — the street's own lighting is dim/blue, so without
  // this the inside of the room would read as a flat black box.
  const lamp = new THREE.PointLight(0xffb870, 1.4, 11, 2);
  lamp.position.set(0, wallHt - 0.7, 0);
  group.add(lamp);
}
// Open ground south of the main street block — clear of its dense building
// mass by a wide margin (checked against the generated collider field), not
// tucked into one of the structure's own internal courtyard gaps where it'd
// be crowded against or hidden behind the existing geometry.
buildStreetOutpost(5, -35);

// Abandoned Street map centerpiece — a real street scene (buildings flanking
// a road, already modeled as a proper street, not a single landmark blob),
// loaded on demand (not at startup) the first time the player picks this
// map in the battlefield picker, and cached so picking it again doesn't
// re-fetch. Deliberately opt-in: at ~13MB it's the heaviest real asset in
// this project, and loading it only for players who actually choose this
// map avoids adding that cost to every page visit the way the always-on
// classic-map assets do.
// Credit: "Abandoned City Street For Games" — see README for details.
//
// Unlike the old city_pack_3 scan (one dense, inseparable mass of attached
// buildings that had to be duplicated/stretched into a fake street), this
// model already IS a street: real buildings on both sides of a road, built
// at human/world scale (its raw bounding box is ~23 x 5.5 x 28 world units —
// i.e. already close to the scale this game uses everywhere else, where
// CFG.eyeHeight is 1.65). So this is used close to as-is: grounded, scaled
// up moderately for a bit more presence, placed once — no duplicating,
// mirroring, or stretching a single landmark to fake a bigger scene.
let streetModelPromise = null;
function loadStreetModel() {
  if (streetModelPromise) return streetModelPromise;
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve();
  streetModelPromise = fetchArrayBufferWithProgress('assets/abandoned_city_street.glb')
    .then((buffer) => new Promise((resolve, reject) => {
      new THREE.GLTFLoader().parse(buffer, '', resolve, reject);
    }))
    .then((gltf) => {
      const template = gltf.scene;
      const box = new THREE.Box3().setFromObject(template);
      const center = box.getCenter(new THREE.Vector3());
      const rawSize = box.getSize(new THREE.Vector3());

      // Ground on the real street level, not the raw bounding-box minimum —
      // same lesson learned from every other real asset in this project: a
      // sliver of below-ground geometry (curbs, gutters, foundations) can
      // sit under the actual walkable street level and drag box.min.y down
      // with it. Sample vertex heights and use a low percentile instead;
      // also collect X/Z alongside Y in the same pass so the same sample
      // set can build the collision footprint below without walking the
      // mesh twice. (Checked this model's actual Y distribution offline
      // first — only a small sliver of points sit meaningfully below street
      // level, consistent with real curbs/gutters, not scan noise.)
      template.updateMatrixWorld(true);
      const sampled = [];
      const vTemp = new THREE.Vector3();
      template.traverse((child) => {
        if (child.isMesh && child.geometry && child.geometry.attributes.position) {
          const posAttr = child.geometry.attributes.position;
          const step = Math.max(1, Math.floor(posAttr.count / 4000));
          for (let i = 0; i < posAttr.count; i += step) {
            vTemp.fromBufferAttribute(posAttr, i).applyMatrix4(child.matrixWorld);
            sampled.push(vTemp.x, vTemp.y, vTemp.z);
          }
        }
      });
      const sampledY = [];
      for (let i = 1; i < sampled.length; i += 3) sampledY.push(sampled[i]);
      sampledY.sort((a, b) => a - b);
      const groundY = sampledY.length ? sampledY[Math.floor(sampledY.length * 0.02)] : box.min.y;

      template.position.x -= center.x;
      template.position.z -= center.z;
      template.position.y -= groundY;
      template.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
        }
      });

      // Uniform scale-up — this model is already built close to world/human
      // scale, so (unlike the old city scan) there's no need to fight its
      // proportions with a non-uniform stretch. 4x makes the typical
      // building/wall piece read as a real towering presence (well past the
      // squat, crate-like look earlier, smaller scale passes had), and the
      // street's own footprint becomes a real place to be inside of rather
      // than something small enough to view end-to-end from outside it.
      const SCALE = 4.0;
      const buildingHalfZ = (rawSize.z * SCALE) / 2;
      // Centered on the world origin rather than placed off in front of
      // spawn — spawn (see startGame's map-aware spawn point) sits inside
      // this model's own interior courtyard, not approaching it from open
      // ground outside, so the player is in the street from the first
      // frame. Keep in sync with STREET_MODEL_CENTER_Z above (used to
      // re-target the shared sun light onto this model before it's loaded).
      const posZ = 0;
      const wrapper = new THREE.Group();
      wrapper.add(template);
      wrapper.scale.setScalar(SCALE);
      wrapper.position.set(0, 0, posZ);
      streetGroup.add(wrapper);
      wrapper.updateMatrixWorld(true);

      // Real collision for the buildings, computed from the actual geometry
      // instead of guessed/hand-placed — but per-MESH here, not the grid-
      // sampling approach used for the old city scan. That technique was
      // built for a single fused, inseparable blob with no per-object
      // granularity; this model is the opposite — a modular kit of ~90
      // separate building-piece meshes with real gaps between them for the
      // street and sidewalks. Running the same grid/occupancy approach on it
      // first produced a fragmented mess of tiny colliders that didn't line
      // up with the actual walkable gaps (confirmed by dumping the
      // generated collider field and comparing it against the model's real
      // layout) — exactly the "can't roam around" symptom. Per-mesh AABBs
      // line up exactly with what's actually modeled instead.
      //
      // Each mesh's TRUE world-space bounding box (after this wrapper's
      // scale/position are applied) decides whether it's a real solid piece
      // or a flat decal: the street/sidewalk meshes in this model are
      // authored as local planes that only end up flat (near-zero world Y
      // extent) once their own node transform is applied, so a flat-ness
      // check has to happen in world space, post-transform — not against
      // the raw local geometry, which can be misleading (some of these
      // "flat" pieces have large-looking local bounds before their node
      // transform squashes them down).
      //
      // An absolute height cutoff alone isn't enough here: this model's
      // ground/plaza slab (one single mesh, ~29x29 world units once
      // scaled) has just enough modeled thickness (~0.8 world units) to
      // clear a small flat height cutoff, which first produced one giant
      // collider covering almost the whole street — exactly the
      // "can't roam around" bug. A flatness RATIO (height vs. footprint)
      // catches that case regardless of absolute scale: a slab this wide
      // reads as paper-thin relative to its footprint even though its
      // absolute thickness isn't tiny, while an actual wall module stays
      // comfortably un-flat at any size. Checked both against every mesh
      // in this model offline first to pick thresholds that keep every
      // real wall/prop and drop every ground/signage/awning decal.
      const pad = 0.1;
      const MIN_SOLID_HEIGHT = 0.12; // world units — drops near-zero-thickness decals outright
      const MIN_FLAT_RATIO = 0.12;   // height / footprint — drops wide-but-thin slabs and panels
      // Pieces placed at an angle (diagonal collapsed-debris panels, rotated
      // wall segments) need an ORIENTED collider, not an axis-aligned one —
      // a plain world-space Box3 around a 45°-rotated piece is up to
      // sqrt(2) bigger on each side than its real footprint, which reads
      // in-game as an invisible wall well before the player reaches the
      // visible geometry (exactly what was reported). Anything within a few
      // degrees of axis-aligned keeps the cheap AABB path — the inflation
      // is negligible there and most of this model's pieces ARE aligned.
      const ROT_THRESHOLD_DEG = 5;
      const meshBox = new THREE.Box3();
      const meshSize = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      const worldPos = new THREE.Vector3();
      const localCenter = new THREE.Vector3();
      let colliderCount = 0;
      template.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        meshBox.setFromObject(child);
        meshBox.getSize(meshSize);
        if (meshSize.y < MIN_SOLID_HEIGHT) return;
        const footprint = Math.max(meshSize.x, meshSize.z);
        if (meshSize.y / Math.max(footprint, 0.001) < MIN_FLAT_RATIO) return;

        child.getWorldQuaternion(worldQuat);
        const yaw = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ').y;
        const yawOffDeg = Math.abs((((yaw * 180 / Math.PI) % 90) + 90) % 90);
        const yawOffFromAxis = Math.min(yawOffDeg, 90 - yawOffDeg);

        if (yawOffFromAxis <= ROT_THRESHOLD_DEG) {
          addCollider(meshBox.min.x - pad, meshBox.min.z - pad, meshBox.max.x + pad, meshBox.max.z + pad, 'street');
        } else {
          // Oriented collider — half-extents come from the mesh's own LOCAL
          // (unrotated) bounding box, scaled by its true world scale, not
          // from the inflated world-space AABB computed above.
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const gBox = child.geometry.boundingBox;
          child.getWorldScale(worldScale);
          localCenter.copy(gBox.min).add(gBox.max).multiplyScalar(0.5);
          worldPos.copy(localCenter).applyMatrix4(child.matrixWorld);
          const hx = ((gBox.max.x - gBox.min.x) / 2) * worldScale.x + pad;
          const hz = ((gBox.max.z - gBox.min.z) / 2) * worldScale.z + pad;
          addRotatedCollider(worldPos.x, worldPos.z, hx, hz, yaw, 'street');
        }
        colliderCount++;
      });
      if (colliderCount === 0) {
        console.error('Abandoned Street map: no solid meshes found for collision — every mesh in the model read as flat. Map will look right but have no building collision.');
      }
    })
    .catch((err) => {
      console.error('Abandoned Street map: failed to load assets/abandoned_city_street.glb — the map will show without the street model.', err);
    });
  return streetModelPromise;
}

// Fetches+parses one boulder model and returns a ready-to-clone template
// (centered on X/Z, rested on Y=0, with its raw horizontal footprint for
// sizing) — shared by loadRealBoulders below for each of the (possibly
// several) boulder variants it swaps in.
function loadBoulderTemplate(url) {
  if (typeof THREE.GLTFLoader !== 'function') return Promise.resolve(null);
  return fetchArrayBufferWithProgress(url)
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
      return { template, maxHorizontal: Math.max(rawSize.x, rawSize.z) };
    })
    .catch((err) => {
      console.error('Boulder template: failed to load ' + url + '.', err);
      return null;
    });
}

// Removes a procedural rock's mesh+chips (scene and envMeshes both) and
// clones the given boulder template in at the same x/z, sized to roughly
// match the footprint the procedural version would have had. No
// addCollider() — buildRock() already registered this spot's collider, so
// this is a same-spot visual swap only.
function swapRockForReal(rock, tpl) {
  scene.remove(rock.mesh);
  let idx = envMeshes.indexOf(rock.mesh);
  if (idx !== -1) envMeshes.splice(idx, 1);
  rock.chips.forEach((chip) => {
    scene.remove(chip);
    idx = envMeshes.indexOf(chip);
    if (idx !== -1) envMeshes.splice(idx, 1);
  });

  const clone = tpl.template.clone(true);
  const wrapper = new THREE.Group();
  wrapper.add(clone);
  // Matches buildRock's own sizing: a rock called with radius s reads as
  // roughly 2*s wide, so scale the real model's own horizontal footprint to
  // land on the same width.
  const scale = (rock.s * 2) / tpl.maxHorizontal;
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
      // Same async-swap-after-map-pick guard as loadRealEnvProp above.
      child.visible = activeMapKey !== 'street';
      envMeshes.push(child);
    }
  });
}

// Swaps real boulder models in for the hand-placed procedural rocks
// registered in rockRegistry[0..cutoff) — the deliberately positioned ones
// the player actually walks past, not the random far-edge dressing. Takes
// one or more model URLs and alternates between them by index (even index
// -> urls[0], odd -> urls[1], etc.) so the arena gets a mix of boulder types
// instead of one shape cloned everywhere. Each variant's template is loaded
// once (not once per instance).
function loadRealBoulders(urls, cutoff) {
  const list = Array.isArray(urls) ? urls : [urls];
  const templates = [];
  // Load each variant one at a time (not Promise.all) — same
  // real-hardware-contention mitigation used everywhere else in this
  // sequential load chain, rather than starting several fetches at once.
  return list.reduce((chain, url) => {
    return chain.then(() => loadBoulderTemplate(url)).then((tpl) => { templates.push(tpl); });
  }, Promise.resolve()).then(() => {
    const valid = templates.filter(Boolean);
    if (valid.length === 0) return;
    rockRegistry.slice(0, cutoff).forEach((rock, i) => {
      const tpl = templates[i % list.length] || valid[0];
      swapRockForReal(rock, tpl);
    });
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
  const ringRadius = Math.max(CFG.arenaHalf, CFG.streetArenaHalf) + 45;
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

