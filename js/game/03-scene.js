/* ============================================================
   SCENE / RENDERER
   ============================================================ */
const container = document.getElementById('app');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x3a2818, 0.024);

let skyMat, sunDiscMesh;
function buildSky() {
  const skyGeo = new THREE.SphereGeometry(280, 24, 16);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x3d3a63) },
      mid: { value: new THREE.Color(0xd97a4a) },
      bottom: { value: new THREE.Color(0xf2b878) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.05
          ? mix(mid, top, smoothstep(0.05, 0.9, h))
          : mix(bottom, mid, smoothstep(-0.15, 0.05, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sunGeo = new THREE.CircleGeometry(16, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, fog: false });
  sunDiscMesh = new THREE.Mesh(sunGeo, sunMat);
  sunDiscMesh.position.set(85, 46, -190);
  sunDiscMesh.lookAt(0, 46, 0);
  scene.add(sunDiscMesh);
}
buildSky();

const camera = new THREE.PerspectiveCamera(save.fov, window.innerWidth / window.innerHeight, 0.1, 340);
let baseFov = save.fov;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   LIGHTING — dusk canyon mood, pushed for cinematic contrast
   ============================================================ */
const hemi = new THREE.HemisphereLight(0xffcf9e, 0x4a3320, 0.65);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffb066, 1.35);
sun.position.set(36, 46, -20);
sun.castShadow = true;
const shadowRes = isTouch ? 1024 : 2048;
sun.shadow.mapSize.set(shadowRes, shadowRes);
const shadowExtent = CFG.arenaHalf + 6;
sun.shadow.camera.left = -shadowExtent; sun.shadow.camera.right = shadowExtent;
sun.shadow.camera.top = shadowExtent; sun.shadow.camera.bottom = -shadowExtent;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0018;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x5f7fa8, 0.22);
fillLight.position.set(-14, 12, 14);
scene.add(fillLight);

// rim/edge light — low warm backlight opposite the sun, separates characters/structures
// from the background for a more cinematic silhouette read. No shadows (cheap).
const rimLight = new THREE.DirectionalLight(0xffddb0, 0.35);
rimLight.position.set(-30, 10, -34);
scene.add(rimLight);

