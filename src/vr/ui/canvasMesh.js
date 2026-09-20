/**
 * Canvas-mesh helpers for the VR settings/button factories.
 *
 * Three pure helpers extracted from VRApp so the orchestrator no longer owns
 * canvas/mesh construction:
 *   - planeGeometry:        width×height-keyed shared PlaneGeometry cache
 *                           (identical buttons share one GPU buffer)
 *   - canvasButton:         canvas + tracked CanvasTexture + shared-geometry
 *                           mesh scaffold every settings button is built on
 *   - controllerRay:        a single shared Raycaster re-aimed per call —
 *                           allocates once instead of per controller per frame
 *
 * All state lives in caller-owned collections (the geometry cache Map and the
 * texture pool array) or module scope (the raycaster), so nothing here holds
 * a VRApp reference.
 */

import * as THREE from 'three';
import { configureUITexture } from './canvasTexture.js';

export function planeGeometry(cache, w, h) {
  const keyStr = `${w}x${h}`;
  let geo = cache.get(keyStr);
  if (!geo) {
    geo = new THREE.PlaneGeometry(w, h);
    cache.set(keyStr, geo);
  }
  return geo;
}

export function canvasButton(geoCache, texPool, w, h, widthM) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = configureUITexture(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  texPool.push(tex);
  const mesh = new THREE.Mesh(
    planeGeometry(geoCache, widthM, 0.17),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  return { ctx, tex, mesh };
}

let _sharedRaycaster = null;
let _tmpRayMatrix = null;

export function controllerRay(controller) {
  if (!_sharedRaycaster) {
    _sharedRaycaster = new THREE.Raycaster();
    _tmpRayMatrix = new THREE.Matrix4();
  }
  const m = _tmpRayMatrix.extractRotation(controller.matrixWorld);
  const raycaster = _sharedRaycaster;
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
  return raycaster;
}
