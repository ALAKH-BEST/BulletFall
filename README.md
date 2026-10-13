# BULLETFALL — Test Arena

A browser-based first-person shooter built with [Three.js](https://threejs.org/) r128, plain JavaScript and CSS — no build step, no bundler, no framework.

## Running it

Because the game fetches its AK47 model from `assets/ak47.glb` at runtime, it needs to be served over HTTP — opening `index.html` directly from disk (`file://`) will fail silently in most browsers, since they block `fetch()` of local files for security reasons.

From this folder, run any static file server, for example:

```bash
python3 -m http.server 8080
```

then open `http://localhost:8080` in your browser.

**GitHub Pages** will serve this correctly with no setup: enable Pages for this repo (Settings → Pages → Deploy from branch → `main` / root), and it'll be playable at `https://<your-username>.github.io/bulletfall/`.

## Project structure

```
index.html          # page shell — markup only, loads everything else
css/style.css        # all styling (HUD, menus, overlays)
js/error-handler.js   # top-level error banner
js/gltf-loader.js     # patched THREE.GLTFLoader (three-gltf-loader v1.111.0, adapted for r128's global/non-module build)
js/game.js            # the game itself — scene setup, weapons, enemies, waves, input, HUD
assets/ak47.glb       # rigged first-person AK47 + hands model, fetched and parsed at startup
```

This used to be one single ~18.8MB HTML file with the AK47 model embedded inline as a base64 string. It's now split into normal files, with the model as its own binary asset (`assets/ak47.glb`, ~13.8MB — base64 always inflates binary size by about a third, so this is smaller too), so the repo reads and diffs like a normal web project instead of one giant blob.

## Weapons

Only the assault rifle currently uses the real scanned model (hands + gun body, with idle/fire/reload animation clips). The shotgun, sniper, SMG and LMG use procedural (primitively-modeled) arms and gun bodies — giving each of them a matching real/rigged model the way the AK47 has one is a natural next step, but needs a model to actually source or make for each; none is embedded yet.

## Credits

- "Ak47" first-person rigged model by kursat_sokmen (https://skfb.ly/6UEL9), licensed CC BY 4.0.
- Three.js r128, MIT License.
- GLTFLoader adapted from three-gltf-loader v1.111.0 by Rich Tibbett / mrdoob, MIT License.
