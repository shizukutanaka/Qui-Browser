/**
 * Lightweight default environment: gradient sky dome, floor with a reference
 * grid, and a welcome panel that doubles as a Recenter button. Kept cheap for
 * Quest-class GPUs (basic materials, no shadows).
 *
 * Returns { env, floor, panelTex } — the caller (VRApp) keeps floor as the
 * teleport target surface and panelTex for explicit disposal. `deps` supplies
 * the interactable registry, recenter action, and live settings; `getCaptionSystem` is read lazily because the caption subsystem is constructed after the environment.
 */

import * as THREE from 'three';
import { configureUITexture } from './ui/canvasTexture.js';
import { t } from '../i18n/i18n.js';

export function createHomeEnvironment({ registerInteractable, recenter, getCaptionSystem, settings }) {
  const env = new THREE.Group();
  env.name = 'homeEnvironment';

  // Gradient sky dome (inside-out sphere, vertex-interpolated colors).
  const skyGeo = new THREE.SphereGeometry(500, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1b2a4a) },
      bottomColor: { value: new THREE.Color(0x0a0d14) }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp((normalize(vWorldPos).y + 1.0) * 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `
  });
  env.add(new THREE.Mesh(skyGeo, skyMat));

  // Floor (subtle, non-reflective).
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x141821 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  env.add(floor);

  // Reference grid — a static rest frame that reduces vection/sickness.
  const grid = new THREE.GridHelper(60, 60, 0x335577, 0x223344);
  grid.position.y = 0.001; // avoid z-fighting with the floor
  env.add(grid);

  // Welcome panel rendered from a canvas texture.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#3a6ea5';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('Qui Browser VR', canvas.width / 2, 120);
  ctx.fillStyle = '#a0b4d0';
  ctx.font = '40px sans-serif';
  ctx.fillText('Welcome — look around to begin', canvas.width / 2, 190);

  const panelTex = configureUITexture(new THREE.CanvasTexture(canvas));
  panelTex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: panelTex, transparent: true })
  );
  panel.position.set(0, 1.6, -2.5);
  env.add(panel);

  // Make the panel a working "Recenter" button (also exercises the
  // interactable + hover pipeline end-to-end).
  registerInteractable(panel, {
    onSelect: () => recenter(),
    onHover: () => {
      panel.material.color.set(0x88bbff);
      const captionSystem = getCaptionSystem();
      if (captionSystem?.enabled && settings.enableGazeDwell) {
        captionSystem.show(t('vr.msg.recenterLabel'));
      }
    },
    onHoverEnd: () => panel.material.color.set(0xffffff)
  });

  return { env, floor, panelTex };
}
