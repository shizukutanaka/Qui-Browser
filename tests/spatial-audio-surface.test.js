/**
 * Guards for the SpatialAudio public surface (round 837).
 *
 * First-principles audit: setSourceOrientation, setSourceVelocity (+ its
 * private simulateDoppler helper), setSourceVolume and createReverb had zero
 * call sites in src/ or tests/ — speculative API surface (YAGNI). These tests
 * pin the removal so the surface doesn't silently grow back, and pin the
 * methods VRApp actually does call so nothing regresses them.
 */

import { SpatialAudio } from '../src/vr/audio/SpatialAudio.js';

const audio = new SpatialAudio();

describe('SpatialAudio dead surface is gone', () => {
  test('exposes no setSourceOrientation / setSourceVelocity / simulateDoppler', () => {
    expect(audio.setSourceOrientation).toBeUndefined();
    expect(audio.setSourceVelocity).toBeUndefined();
    expect(audio.simulateDoppler).toBeUndefined();
  });

  test('exposes no setSourceVolume / createReverb / fadeVolume (zero call sites)', () => {
    expect(audio.setSourceVolume).toBeUndefined();
    expect(audio.createReverb).toBeUndefined();
    expect(audio.fadeVolume).toBeUndefined();
  });
});

describe('SpatialAudio live surface is intact', () => {
  test.each([
    'createSource',
    'play',
    'stop',
    'setSourcePosition',
    'setMasterVolume',
    'updateListenerFromCamera',
    'getStats'
  ])('still exposes %s', (name) => {
    expect(typeof audio[name]).toBe('function');
  });

  test('createSource sources carry no dead velocity field', () => {
    // With the doppler path removed nothing ever writes or reads source.velocity.
    // Stub the minimum audio context surface createSource() needs.
    const a = new SpatialAudio();
    a.context = {
      createPanner: () => ({ connect: () => {} }),
      createGain: () => ({ connect: () => {}, gain: { value: 1 } })
    };
    const src = a.createSource('s', {});
    expect(src.velocity).toBeUndefined();
    expect(src.playbackRate).toBe(1.0); // live: read by play()
  });
});
