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
assets/ak47.glb                # rigged first-person AK47 + hands model, fetched and parsed at startup
assets/shotgun_real.glb        # static Remington 870 MCS model, swapped in over the procedural shotgun body
assets/lmg_real.glb            # static Browning M2 model, swapped in over the procedural LMG body
assets/shipping_container.glb  # real shipping-container model, swapped in for some of the big procedural crates
assets/concrete_barrier.glb    # real Jersey-style concrete road barrier, lining the central road
assets/sandbag_wall.glb        # real stacked-sandbag model, layered over the procedural sandbag positions
assets/boulder_real.glb        # real boulder model (Boulder 01, converted from Poly Haven's .blend source), swapped in for the hand-placed procedural rocks
assets/boulder_real2.glb       # second real boulder variant (Namaqualand Boulder 03), alternated with boulder_real.glb for visual variety
assets/old_factory.glb         # real scanned factory building, the Derelict Factory map's centerpiece — loaded on demand, not at startup
```

This used to be one single ~18.8MB HTML file with the AK47 model embedded inline as a base64 string. It's now split into normal files, with models as their own binary assets (fetched at runtime instead of base64-baked into the page — base64 always inflates binary size by about a third, so this is smaller too), so the repo reads and diffs like a normal web project instead of one giant blob.

## Weapons

- **Assault rifle** — the real scanned AK47 model: rigged hands + gun body, with idle/fire/reload animation clips.
- **Shotgun** and **LMG** — real static gun meshes (Remington 870 MCS, Browning M2) swapped in over where the procedural box-and-cylinder body used to sit. These aren't rigged/animated like the AK47 — just a nicer-looking mesh held by the same procedural arms every other weapon uses. Swapping in a real mesh this way (rather than reusing the AK47 rig's animated bones) is deliberately low-risk: see the comment above `REAL_HANDS_WEAPONS` in `js/game.js` for why bone-sharing across weapons was tried and abandoned.
- **Sniper** and **SMG** — still fully procedural; no real model sourced for these yet (Sketchfab didn't have a free-download option for the ones found, only preview-only listings).
- **LMG specifically** is "deployed" rather than carried: equipping it (`5`) locks player movement and jumping in place (bipod down), dips the view slightly, and tightens bullet spread — meant to feel like setting up a braced gun position rather than just holding a bigger rifle. Switching to any other weapon un-deploys it instantly.
- **Combat Knife** (`6`) — a melee weapon, purely procedural like the shotgun/sniper/SMG/LMG bodies (no fetched asset, deliberately — real-sourced env props have caused real-hardware GPU/texture regressions more than once in this project, so the one weapon with zero download risk stays hand-built). No ammo, no reload — it's a short-range single raycast on each swing instead of ranged ballistics, with its own quick slash-kick animation and whoosh sound effect in place of a muzzle flash/casing eject. Right-click doesn't aim down sights with it equipped. The HUD shows "MELEE" instead of an ammo count, and knife swings aren't counted into the accuracy stat (which tracks gunplay, not melee).

## Pickups

Killed bots have a chance to drop a pickup at their feet — an ammo crate or a medikit, bobbing and slowly spinning in place. Walk over one to collect it:

- **Ammo crate** — refills the *currently equipped* weapon's reserve ammo by 30-55% of its max. Left alone if that weapon's reserve is already full.
- **Medikit** — heals the player 35 HP. Left alone if already at full health.

Drops despawn after ~22 seconds if not collected (fading out just before they do), so the arena doesn't fill up with permanent clutter over a long run.

## Maps

The battlefield picker (reached after pressing Deploy) offers two maps, sharing all progression, weapons and the wave system:

- **Dustline Canyon** *(default)* — the original sun-scorched canyon arena.
- **Derelict Factory** *(high graphics)* — an abandoned industrial complex, centered on a real scanned factory building standing in for the old Arctic Outpost map. It's the heaviest real asset in this project (~11MB, ~114k triangles), so unlike every other real model here it is **not** fetched at startup — `loadFactoryModel()` only runs the first time a player actually picks this map in the picker (cached after that), so players who never choose it never pay for the download. A performance warning dialog (the same one the old Arctic map used) is shown before deployment.

The factory building itself is a single landmark to fight around, not an explorable interior — same role the old Arctic map's command shelter played, just considerably bigger. Its footprint uses one collider sized from the model's own measured bounding box, the same approach used for every other real env prop here.

**Licensing note on the factory model**: unlike every other real asset in this project (all CC0 or CC-BY, both of which explicitly permit redistribution), "old factory FREE" by dasy444 is Sketchfab **Standard**-licensed, which restricts making the model available as a standalone, extractable file — and committing `assets/old_factory.glb` straight into this public repo, the same way every other asset here is shipped, is arguably exactly that. It's included anyway at the repo owner's explicit instruction, with the license and source noted here for transparency. Swap in a CC0/CC-BY model (Poly Haven is a reliable source for CC0 industrial assets) if that tradeoff matters for your use.

## Environment props

Real sourced models have been built for several of the procedural boxes/barriers/rocks in the arena, the same way the shotgun and LMG got real gun meshes. These went live in stages, one at a time, after the full container+barrier+sandbag+boulder chain caused a real-hardware regression on first attempt (the AK47 and even the always-present procedural crates disappeared — consistent with a WebGL context loss from exceeding the device's GPU/texture memory budget). Boulders went back in first, alone, and were confirmed working; the shipping container followed once that was confirmed safe. Concrete barrier and sandbag wall are still disabled, code left in place in `js/game.js`, to keep bringing real assets back one isolated step at a time rather than all at once:

- **Shipping container** *(live)* — replaces four of the largest procedural crates near the central combat area.
- **Concrete barrier** *(disabled)* — would line the central road as cover, alternating sides.
- **Sandbag wall** *(disabled)* — would layer visually over the two existing sandbag positions.
- **Boulders** *(live)* — the ~16 hand-placed procedural rocks the player actually walks past (not the random far-edge boundary dressing) are swapped for real boulder models, cloned at each spot and scaled to roughly match the footprint the procedural rock would have had. Two boulder variants alternate by position for visual variety. Collision is untouched — it's a same-spot visual swap over colliders the procedural rock already registered.

Real assets load one at a time, each only starting once the previous one (and the AK47) has fully settled — the same sequencing used for the real gun models, to avoid stacking several large downloads on page load at once.

Both boulders came from [Poly Haven](https://polyhaven.com/a/boulder_01) as `.blend` files (CC0; Poly Haven doesn't offer a lighter LOD as a direct glTF download) — converted locally with Blender's Python API (`bpy`): kept only the mid-detail LOD1 mesh, downscaled its 1k textures to 512px, and exported to `.glb` (down from an ~11.5MB everything-included export to ~2.6MB each).

## HUD: minimap, kill feed, damage numbers

- **Minimap** (top-right) — a player-facing-up top-down radar. Red dots are hostiles (brighter orange for elites), teal/gold dots are nearby pickups, white arrow is always the player facing "up".
- **Kill feed** (below the minimap) — stacks up to 5 recent eliminations ("YOU ↠ HOSTILE TYPE", headshots tagged in yellow), each fading out a few seconds after it lands.
- **Damage numbers** — float up from the hit point on every bot hit: white for a body shot, yellow for a headshot, orange for the shot that finishes the kill.

## Credits

- "Ak47" first-person rigged model by kursat_sokmen (https://skfb.ly/6UEL9), licensed CC BY 4.0.
- "Low-Poly Browning M2E2" by Kaan (https://skfb.ly/ovSrR), licensed CC Attribution 4.0 (http://creativecommons.org/licenses/by/4.0/).
- "870 MCS Shotgun" by FelipeMSX (https://sketchfab.com/3d-models/870-mcs-shotgun-8fa7d482920e4eda8648766fb38596c0), licensed CC Attribution.
- "Shipping Container" by chaschinkaa (https://sketchfab.com/3d-models/shipping-container-7bf5a49425134544b9b6708c4e45ce11), licensed CC Attribution 4.0.
- "Lowpoly Concrete Barrier" by qb (https://sketchfab.com/3d-models/lowpoly-concrete-barrier-e0fb4ba5ee434433bbdb4a16aaa2f8fb), licensed CC Attribution 4.0.
- "Sandbag Wall 04" by Pypunk (https://sketchfab.com/3d-models/sandbag-wall-04-a5ea125e9d534b54a3185f349da6aabd), licensed CC Attribution 4.0.
- "Boulder 01" from Poly Haven (https://polyhaven.com/a/boulder_01), CC0 — no attribution required, credited here anyway.
- "Namaqualand Boulder 03" from Poly Haven (https://polyhaven.com/a/namaqualand_boulder_03), CC0 — no attribution required, credited here anyway.
- "old factory FREE" by dasy444 (https://sketchfab.com/3d-models/old-factory-free-9d0acdbe78944c098689c0d34853e57b), Sketchfab Standard license — see the licensing note under Maps above.
- Three.js r128, MIT License.
- GLTFLoader adapted from three-gltf-loader v1.111.0 by Rich Tibbett / mrdoob, MIT License.
