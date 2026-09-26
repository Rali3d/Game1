import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Pieces of a single mesh that use one material: splits multi-material meshes (common in FBX) by group.
function pieces(o) {
  const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
  for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
  if (!Array.isArray(o.material)) return [[o.material, geo]];
  const out = [];
  const index = geo.index.array;
  for (const grp of geo.groups) {
    const part = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) part.setAttribute(name, attr);
    part.setIndex(Array.from(index.slice(grp.start, grp.start + grp.count)));
    out.push([o.material[grp.materialIndex], part]);
  }
  return out;
}

// Bake every mesh under `group` into one mesh per material: a whole building or ruin in a few draw calls.
export function mergeByMaterial(group, { cast = true } = {}) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    for (const [material, geo] of pieces(o)) {
      if (!byMat.has(material)) byMat.set(material, []);
      byMat.get(material).push(geo);
    }
  });
  const out = new THREE.Group();
  for (const [material, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast && !material.transparent;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

// Merge the static meshes under `group` in place (in the group's own space), leaving alone anything inside
// the `keep` objects (things that move or animate on their own) and non-mesh objects like sprites.
export function mergeStatic(group, keep = []) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const keepSet = new Set(keep.filter(Boolean));
  const byMat = new Map();
  const merged = [];
  const visit = (o) => {
    if (keepSet.has(o)) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) {
      const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (const [material, geo] of pieces({ geometry: o.geometry, material: o.material, matrixWorld: rel })) {
        const key = material;
        if (!byMat.has(key)) byMat.set(key, { geos: [], cast: false });
        const e = byMat.get(key);
        e.geos.push(geo);
        e.cast ||= o.castShadow;
      }
      merged.push(o);
    }
    for (const c of [...o.children]) visit(c);
  };
  for (const c of [...group.children]) visit(c);
  for (const o of merged) o.removeFromParent();
  for (const [material, { geos, cast }] of byMat) {
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast && !material.transparent;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
