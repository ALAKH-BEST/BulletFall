/* ============================================================
   THEME APPLICATION — retints shared geometry, no rebuilds needed
   ============================================================ */
function applyTheme(key) {
  const theme = THEMES[key];
  if (!theme) return;
  currentThemeKey = key;

  // sky + fog
  skyMat.uniforms.top.value.set(theme.sky.top);
  skyMat.uniforms.mid.value.set(theme.sky.mid);
  skyMat.uniforms.bottom.value.set(theme.sky.bottom);
  sunDiscMesh.material.color.set(theme.sun.disc);
  scene.fog.color.set(theme.fog.color);
  hazeMat.color.set(theme.fog.color);
  scene.fog.density = theme.fog.density;

  // lighting
  hemi.color.set(theme.hemi.sky);
  hemi.groundColor.set(theme.hemi.ground);
  hemi.intensity = theme.hemiIntensity;
  sun.color.set(theme.sun.light);
  sun.intensity = theme.sunIntensity;
  fillLight.color.set(theme.fill);
  rimLight.color.set(theme.sun.disc);
  renderer.toneMappingExposure = theme.exposure;

  // floor
  const newSand = buildSandTexture(theme);
  const newTex = new THREE.CanvasTexture(newSand);
  newTex.wrapS = newTex.wrapT = THREE.RepeatWrapping;
  newTex.repeat.set(9, 9);
  newTex.anisotropy = 8;
  newTex.encoding = THREE.sRGBEncoding;
  if (floorMat.map) floorMat.map.dispose();
  floorMat.map = newTex;
  floorMat.needsUpdate = true;

  // walls
  wallMat.color.set(theme.wall);

  // crates
  const c1 = buildCrateTexture(theme.crate1.base, theme.crate1.band);
  const c2 = buildCrateTexture(theme.crate2.base, theme.crate2.band);
  if (crateMat1.map) crateMat1.map.dispose();
  if (crateMat2.map) crateMat2.map.dispose();
  crateMat1.map = c1; crateMat1.needsUpdate = true;
  crateMat2.map = c2; crateMat2.needsUpdate = true;

  // ruined structures
  const stoneTex = buildStoneTexture(theme.crate1.base, theme.crate1.band);
  if (ruinMat.map) ruinMat.map.dispose();
  ruinMat.map = stoneTex; ruinMat.needsUpdate = true;

  // rocks (individual, baked vertex-color variation tinted via material.color)
  rockMat.color.set(theme.rockTint);
  // pebbles + grass (instanced ground clutter, flat material.color tint)
  pebbleMat.color.set(theme.rockTint);
  grassMat.color.set(theme.grass);
  bushMat.color.set(theme.grass);

  // distant mountain ring
  mountainMat.color.set(theme.rockTint);
  farRidgeMat.color.set(theme.rockTint).multiplyScalar(0.78);
  shaleMat.color.set(theme.rockTint);
  scrubMat.color.set(theme.grass);
}
applyTheme(currentThemeKey);

/* Map select UI (mission briefing screen) */
const THEME_BLURBS = {
  dustline: 'Sun-scorched canyon ridgelines and crumbling supply outposts.',
  street: 'An abandoned city street, buildings looming on both sides of a dead road.',
  nightshade: 'Neon-lit ruins under a bleeding violet sky.',
};
const themeSwatchesEl = document.getElementById('theme-swatches');
const briefingEnvEl = document.getElementById('briefing-env');
Object.keys(THEMES).forEach((key) => {
  const theme = THEMES[key];
  const card = document.createElement('div');
  card.className = 'map-card' + (key === currentThemeKey ? ' selected' : '');
  card.dataset.theme = key;
  card.innerHTML = `
    <div class="map-card-preview" style="background:linear-gradient(160deg, ${theme.swatch[0]}, ${theme.swatch[1]}, ${theme.swatch[2]});">
      <div class="map-card-tag">Active</div>
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${theme.name}</div>
      <div class="map-card-blurb">${THEME_BLURBS[key] || ''}</div>
    </div>
  `;
  card.addEventListener('click', () => {
    document.querySelectorAll('.map-card').forEach(el => el.classList.remove('selected'));
    card.classList.add('selected');
    applyTheme(key);
    if (briefingEnvEl) briefingEnvEl.textContent = theme.name;
  });
  themeSwatchesEl.appendChild(card);
});
if (briefingEnvEl) briefingEnvEl.textContent = THEMES[currentThemeKey].name;

