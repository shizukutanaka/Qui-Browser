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

  test('exposes no setSourceVolume / createReverb (zero call sites)', () => {
    expect(audio.setSourceVolume).toBeUndefined();
    expect(audio.createReverb).toBeUndefined();
  });

  test('getStats returns only the consumed fields', () => {
    // getStats() has exactly one consumer — tests/spatial-audio.test.js — and it
    // reads only the stats counters plus hrtfThreshold. Fields describing a
    // WebAudio diagnostics surface nothing reads (contextState, currentTime,
    // sampleRate, latency) are write-only payload.
    const a = new SpatialAudio();
    a.context = { state: 'running', currentTime: 1.5, sampleRate: 48000, baseLatency: 0.01 };
    expect(a.getStats()).toEqual({
      sourcesActive: 0,
      buffersLoaded: 0,
      totalPlayTime: 0,
      cpuLoad: 0,
      hrtfSources: 0,
      equalPowerSources: 0,
      hrtfThreshold: 15
    });
  });
});

describe('SpatialAudio live surface is intact', () => {
  test.each([
    'createSource',
    'play',
    'stop',
    'setSourcePosition',
    'setMasterVolume',
    'fadeVolume',
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
