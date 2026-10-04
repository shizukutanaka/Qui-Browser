/**
 * _disposeSettingsPanel must free the panel generation's GPU resources.
 *
 * Every make*Button helper pushes its CanvasTexture into _panelTextures and
 * wraps it in a per-mesh MeshBasicMaterial. _rebuildSettingsPanel calls
 * _disposeSettingsPanel on every accordion tab toggle — if the previous
 * generation's textures/materials survive, they accumulate for the whole
 * session (~15+ CanvasTextures per toggle). The toast path (:846-848) already
 * disposes mesh.geometry/map/material; the settings-panel path must do the
 * same for its per-mesh resources — while leaving the shared plane geometry
 * untouched (it is owned by _sharedGeometries, not the panel). Per-generation
 * geometries — the panel background quad is the one today — are disposed;
 * only geometries registered in _sharedGeometries survive a rebuild.
 */
import * as THREE from 'three';

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

import { VRApp } from '../src/vr/VRApp.js';

function makeApp() {
  const app = Object.create(VRApp.prototype);
  app.interactables = [];
  app._panelTextures = [];
  app._settingsPanelDrawers = [];
  app._sharedGeometries = new Map();
  app.settingsPanel = null;
  app.scene = new THREE.Group();
  app.unregisterInteractable = jest.fn((m) => {
    const i = app.interactables.indexOf(m);
    if (i !== -1) {
      app.interactables.splice(i, 1);
    }
  });
  return app;
}

function makePanelMesh(app) {
  const tex = { dispose: jest.fn() };
  const material = { map: tex, dispose: jest.fn() };
  const geometry = { dispose: jest.fn() }; // shared geometry stand-in
  app._sharedGeometries.set(`g${app._sharedGeometries.size}`, geometry);
  const mesh = new THREE.Object3D();
  mesh.isMesh = true;
  mesh.material = material;
  mesh.geometry = geometry;
  app.interactables.push(mesh);
  app._panelTextures.push(tex);
  return { mesh, tex, material, geometry };
}

describe('_disposeSettingsPanel', () => {
  test('disposes every mesh material and its map, and drops the texture from _panelTextures', () => {
    const app = makeApp();
    const group = new THREE.Group();
    const a = makePanelMesh(app);
    const b = makePanelMesh(app);
    group.add(a.mesh, b.mesh);
    app.settingsPanel = group;
    app.scene.add(group);

    app._disposeSettingsPanel();

    expect(a.tex.dispose).toHaveBeenCalledTimes(1);
    expect(a.material.dispose).toHaveBeenCalledTimes(1);
    expect(b.tex.dispose).toHaveBeenCalledTimes(1);
    expect(b.material.dispose).toHaveBeenCalledTimes(1);
    // The live teardown set must not retain the dead generation's refs.
    expect(app._panelTextures).toEqual([]);
    // Shared plane geometry is owned by _sharedGeometries — never disposed here.
    expect(a.geometry.dispose).not.toHaveBeenCalled();
    expect(b.geometry.dispose).not.toHaveBeenCalled();
    // Interactables still get unregistered, and the group leaves its parent.
    expect(app.unregisterInteractable).toHaveBeenCalledTimes(2);
    expect(group.parent).toBeNull();
  });

  test('materials without a map are disposed without touching _panelTextures', () => {
    const app = makeApp();
    const group = new THREE.Group();
    const material = { map: null, dispose: jest.fn() };
    const mesh = new THREE.Object3D();
    mesh.isMesh = true;
    mesh.material = material;
    mesh.geometry = { dispose: jest.fn() };
    group.add(mesh);
    app.settingsPanel = group;

    app._disposeSettingsPanel();

    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(app._panelTextures).toEqual([]);
  });

  test('a texture already removed from _panelTextures is not re-spliced (double-dispose safe)', () => {
    const app = makeApp();
    const group = new THREE.Group();
    const { mesh, tex, material } = makePanelMesh(app);
    app._panelTextures.length = 0; // simulate already-spliced
    const other = { dispose: jest.fn() };
    app._panelTextures.push(other);
    group.add(mesh);
    app.settingsPanel = group;

    app._disposeSettingsPanel();

    expect(tex.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    // Unrelated tracked textures survive — only this generation is freed.
    expect(app._panelTextures).toEqual([other]);
  });

  test('per-generation geometries are disposed while shared ones survive', () => {
    const app = makeApp();
    const group = new THREE.Group();
    // The panel background quad creates a unique PlaneGeometry every build
    // (its size depends on the layout height) — the only non-shared geometry
    // in the panel. Its material has no map.
    const bgGeometry = { dispose: jest.fn() };
    const bgMaterial = { map: null, dispose: jest.fn() };
    const bg = new THREE.Object3D();
    bg.isMesh = true;
    bg.material = bgMaterial;
    bg.geometry = bgGeometry;
    group.add(bg);
    const { mesh: btn, geometry: sharedGeo } = makePanelMesh(app);
    group.add(btn);
    app.settingsPanel = group;

    app._disposeSettingsPanel();

    expect(bgGeometry.dispose).toHaveBeenCalledTimes(1);
    expect(bgMaterial.dispose).toHaveBeenCalledTimes(1);
    expect(sharedGeo.dispose).not.toHaveBeenCalled();
  });
});

describe('_rebuildSettingsPanel', () => {
  test('frees the old generation before attaching the new one and preserves visibility', () => {
    const app = makeApp();
    const group = new THREE.Group();
    const { mesh, tex, material } = makePanelMesh(app);
    group.add(mesh);
    group.visible = true;
    app.settingsPanel = group;
    app.scene.add(group);

    const nextPanel = new THREE.Group();
    app.createSettingsPanel = jest.fn(() => nextPanel);

    app._rebuildSettingsPanel();

    expect(tex.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(app._panelTextures).toEqual([]);
    expect(app.settingsPanel).toBe(nextPanel);
    expect(nextPanel.visible).toBe(true);
    expect(nextPanel.parent).toBe(app.scene);
  });
});
