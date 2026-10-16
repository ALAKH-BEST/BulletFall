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
index.html             # page shell — markup only, loads everything else
css/style.css           # all styling (HUD, menus, overlays)
js/error-handler.js      # top-level error banner
js/gltf-loader.js        # patched THREE.GLTFLoader (three-gltf-loader v1.111.0, adapted for r128's global/non-module build)
js/game.js               # the game itself — scene setup, weapons, enemies, waves, input, HUD
assets/ak47.glb          # rigged first-person AK47 + hands model, fetched and parsed at startup
assets/shotgun_real.glb  # static Remington 870 MCS model, swapped in over the procedural shotgun body
assets/lmg_real.glb      # static Browning M2 model, swapped in over the procedural LMG body
```

This used to be one single ~18.8MB HTML file with the AK47 model embedded inline as a base64 string. It's now split into normal files, with models as their own binary assets (fetched at runtime instead of base64-baked into the page — base64 always inflates binary size by about a third, so this is smaller too), so the repo reads and diffs like a normal web project instead of one giant blob.

## Weapons

- **Assault rifle** — the real scanned AK47 model: rigged hands + gun body, with idle/fire/reload animation clips.
- **Shotgun** and **LMG** — real static gun meshes (Remington 870 MCS, Browning M2) swapped in over where the procedural box-and-cylinder body used to sit. These aren't rigged/animated like the AK47 — just a nicer-looking mesh held by the same procedural arms every other weapon uses. Swapping in a real mesh this way (rather than reusing the AK47 rig's animated bones) is deliberately low-risk: see the comment above `REAL_HANDS_WEAPONS` in `js/game.js` for why bone-sharing across weapons was tried and abandoned.
- **Sniper** and **SMG** — still fully procedural; no real model sourced for these yet (Sketchfab didn't have a free-download option for the ones found, only preview-only listings).
- **LMG specifically** is "deployed" rather than carried: equipping it (`5`) locks player movement and jumping in place (bipod down), dips the view slightly, and tightens bullet spread — meant to feel like setting up a braced gun position rather than just holding a bigger rifle. Switching to any other weapon un-deploys it instantly.

## Pickups

Killed bots have a chance to drop a pickup at their feet — an ammo crate or a medikit, bobbing and slowly spinning in place. Walk over one to collect it:

- **Ammo crate** — refills the *currently equipped* weapon's reserve ammo by 30-55% of its max. Left alone if that weapon's reserve is already full.
- **Medikit** — heals the player 35 HP. Left alone if already at full health.

Drops despawn after ~22 seconds if not collected (fading out just before they do), so the arena doesn't fill up with permanent clutter over a long run.

## Credits

- "Ak47" first-person rigged model by kursat_sokmen (https://skfb.ly/6UEL9), licensed CC BY 4.0.
- "Low-Poly Browning M2E2" by Kaan (https://skfb.ly/ovSrR), licensed CC Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/).
- "870 MCS Shotgun" by FelipeMSX (https://sketchfab.com/3d-models/870-mcs-shotgun-8fa7d482920e4eda8648766fb38596c0), licensed CC Attribution.
- Three.js r128, MIT License.
- GLTFLoader adapted from three-gltf-loader v1.111.0 by Rich Tibbett / mrdoob, MIT License.
