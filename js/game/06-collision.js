/* ============================================================
   COLLISION HELPERS
   ============================================================ */
function resolveCircleVsBoxes(pos, radius, ignoreList) {
  for (const box of collidables) {
    if (box.map && box.map !== activeMapKey) continue;
    let dx, dz, dist;
    let rotCos = 1, rotSin = 0; // identity — only used to rotate the push vector back for oriented boxes
    if (box.rot) {
      // Oriented box — work in the box's own local, unrotated frame: rotate
      // the player position by -rot around the box's center, do the usual
      // clamp-to-box-then-measure-distance against its HALF-extents, then
      // rotate whatever push results back into world space. This is what
      // keeps collision hugging an angled piece's real footprint instead of
      // its (much bigger) axis-aligned bounding box — see addRotatedCollider.
      const c = Math.cos(-box.rot), s = Math.sin(-box.rot);
      const relX = pos.x - box.cx, relZ = pos.z - box.cz;
      const lx = relX * c - relZ * s;
      const lz = relX * s + relZ * c;
      const clx = Math.max(-box.hx, Math.min(lx, box.hx));
      const clz = Math.max(-box.hz, Math.min(lz, box.hz));
      dx = lx - clx; dz = lz - clz;
      dist = Math.sqrt(dx * dx + dz * dz);
      rotCos = Math.cos(box.rot); rotSin = Math.sin(box.rot);
    } else {
      const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
      const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
      dx = pos.x - cx; dz = pos.z - cz;
      dist = Math.sqrt(dx * dx + dz * dz);
    }
    if (dist < radius) {
      let pushX, pushZ;
      if (dist === 0) {
        // Center landed exactly on/inside the box (common once a collider's
        // footprint straddles the x=0 centerline the player walks along) —
        // push out by a flat `radius` along an arbitrary fixed axis instead
        // of normalizing (dx, dz). The old code reused the stale dist=0.001
        // as the normalization divisor after resetting dx/dz to a unit
        // vector, so it divided by 0.001 instead of 1 — flinging the player
        // ~1000x radius sideways in one frame instead of nudging them out.
        pushX = radius; pushZ = 0;
      } else {
        const push = (radius - dist);
        pushX = (dx / dist) * push;
        pushZ = (dz / dist) * push;
      }
      if (box.rot) {
        // Rotate the local-space push vector back into world space.
        pos.x += pushX * rotCos - pushZ * rotSin;
        pos.z += pushX * rotSin + pushZ * rotCos;
      } else {
        pos.x += pushX;
        pos.z += pushZ;
      }
    }
  }
  const limit = (activeMapKey === 'street' ? CFG.streetArenaHalf : CFG.arenaHalf) - 0.6;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

