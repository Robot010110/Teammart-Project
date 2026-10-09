import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { SFX } from './config';
import { SceneKey, sceneClock, SCENES } from './lib/timing';

/**
 * Sound-design cue sheet. Each cue is anchored to a scene and a beat
 * (authored in 60-fps frames from the scene start), so cues move with the
 * picture if you change TIMING in config.ts.
 *
 * To add audio: put files in public/sfx/ named after each cue's `file`,
 * then set SFX.enabled = true in config.ts. Every file listed here must
 * exist once enabled (delete cues you don't want rather than leaving
 * their files out).
 */
export type Cue = { scene: SceneKey; at: number; file: string; volume: number; note: string };

export const CUES: Cue[] = [
  // S1 CHAOS
  { scene: 'chaos', at: 2, file: 'notification-pop.wav', volume: 0.7, note: 'First bubble pops in' },
  { scene: 'chaos', at: 12, file: 'whoosh-small.wav', volume: 0.45, note: 'Wave 1 entries begin (layer one whoosh+pop per element, f12–f292)' },
  { scene: 'chaos', at: 40, file: 'vibration-bed.wav', volume: 0.5, note: 'Phone-vibration bed, rising with the camera shake' },
  { scene: 'chaos', at: 120, file: 'dissonant-pad.wav', volume: 0.5, note: 'Pad swells with the warm alarm glow' },
  { scene: 'chaos', at: 200, file: 'hero-thud.wav', volume: 0.6, note: '"who\'s covering Zone 3?" slams in' },
  // S2 BEAT
  { scene: 'beat', at: 0, file: 'low-hit.wav', volume: 1.0, note: 'THE FREEZE — low hit + tape-stop' },
  { scene: 'beat', at: 18, file: 'reverse-suck.wav', volume: 0.75, note: 'Everything snaps into the point of light' },
  { scene: 'beat', at: 60, file: 'light-tink.wav', volume: 0.6, note: 'Light flares; shockwave' },
  { scene: 'beat', at: 72, file: 'word-ticks.wav', volume: 0.35, note: 'Soft tick per word of "What if every market ran like one team?"' },
  { scene: 'beat', at: 162, file: 'whoosh-out.wav', volume: 0.5, note: 'Words exit' },
  // S3 STRUCTURE
  { scene: 'structure', at: 0, file: 'bloom-whomp.wav', volume: 0.8, note: 'Light blooms into the HQ node' },
  { scene: 'structure', at: 20, file: 'tick-rise-3.wav', volume: 0.5, note: 'Three zones pop' },
  { scene: 'structure', at: 80, file: 'tick-cascade.wav', volume: 0.45, note: 'Nine markets pop clockwise' },
  { scene: 'structure', at: 150, file: 'granular-shimmer.wav', volume: 0.45, note: '36 employees ripple in' },
  { scene: 'structure', at: 260, file: 'chime-1.wav', volume: 0.55, note: 'Admin badge — whole disc lights' },
  { scene: 'structure', at: 320, file: 'chime-2.wav', volume: 0.55, note: 'Regional Manager badge — zone wedge' },
  { scene: 'structure', at: 380, file: 'chime-3.wav', volume: 0.55, note: 'Supervisor badge — market wedge' },
  { scene: 'structure', at: 440, file: 'riser-short.wav', volume: 0.4, note: 'Riser into the push-in' },
  // S4 WORKFLOW
  { scene: 'workflow', at: -18, file: 'push-whoosh.wav', volume: 0.6, note: 'Camera pushes into the Regional Manager node' },
  { scene: 'workflow', at: 40, file: 'card-pop.wav', volume: 0.55, note: 'Task card springs out' },
  { scene: 'workflow', at: 102, file: 'zip-down.wav', volume: 0.6, note: 'Task packet shoots down to the Supervisor' },
  { scene: 'workflow', at: 150, file: 'impact-rise.wav', volume: 0.6, note: 'Packet lands, phone rises' },
  { scene: 'workflow', at: 192, file: 'notification-chime.wav', volume: 0.6, note: 'Push notification' },
  { scene: 'workflow', at: 254, file: 'ui-tap.wav', volume: 0.5, note: 'Tap "Start task"' },
  { scene: 'workflow', at: 284, file: 'camera-shutter.wav', volume: 0.55, note: 'Photo evidence captured' },
  { scene: 'workflow', at: 330, file: 'ui-tap-positive.wav', volume: 0.6, note: 'Tap "Mark complete" — positive blip' },
  { scene: 'workflow', at: 380, file: 'lift-swish.wav', volume: 0.45, note: 'Task lifts off the phone' },
  { scene: 'workflow', at: 402, file: 'whoosh-up.wav', volume: 0.6, note: 'Packet flies back up' },
  { scene: 'workflow', at: 478, file: 'ui-click.wav', volume: 0.5, note: 'Approve pressed' },
  { scene: 'workflow', at: 496, file: 'approve-ding.wav', volume: 0.85, note: 'THE CHECK — confirmation ding + soft sub' },
  { scene: 'workflow', at: 544, file: 'whoosh-big-out.wav', volume: 0.7, note: 'Fast pull-back' },
  // S5 DASHBOARD
  { scene: 'dashboard', at: 2, file: 'ui-swell.wav', volume: 0.5, note: 'Dashboard settles in' },
  { scene: 'dashboard', at: 30, file: 'counter-ticks.wav', volume: 0.35, note: 'Counters tick up, panels whoosh in (staggered)' },
  { scene: 'dashboard', at: 170, file: 'tick-chime.wav', volume: 0.45, note: 'Live update: the approved task lands in the feed' },
  { scene: 'dashboard', at: 290, file: 'shimmer-sweep.wav', volume: 0.55, note: 'Light sweep reveals the real product' },
  { scene: 'dashboard', at: 326, file: 'whoosh-device-1.wav', volume: 0.45, note: 'Phone 1 slides in' },
  { scene: 'dashboard', at: 334, file: 'whoosh-device-2.wav', volume: 0.45, note: 'Phone 2 slides in' },
  { scene: 'dashboard', at: 342, file: 'whoosh-device-3.wav', volume: 0.45, note: 'Phone 3 slides in' },
  { scene: 'dashboard', at: 420, file: 'riser-short.wav', volume: 0.4, note: 'Riser into the close' },
  // S6 CLOSE
  { scene: 'close', at: 0, file: 'whoosh-in.wav', volume: 0.6, note: 'Devices converge to the light' },
  { scene: 'close', at: 30, file: 'low-hit-soft.wav', volume: 0.7, note: 'Lighter low hit as the logo forms' },
  { scene: 'close', at: 40, file: 'logo-build.wav', volume: 0.55, note: 'Crystalline build of the mark' },
  { scene: 'close', at: 130, file: 'tagline-swell.wav', volume: 0.45, note: 'Tagline' },
  { scene: 'close', at: 190, file: 'soft-click.wav', volume: 0.4, note: 'CTA appears' },
  { scene: 'close', at: 240, file: 'reverb-tail.wav', volume: 0.4, note: 'Tail' },
];

/** Absolute frame for a cue (respects scene stretching in config.ts). */
export const cueFrame = (cue: Cue) => Math.round(SCENES[cue.scene].start + sceneClock(cue.scene, 0).at(cue.at));

export const SfxTrack: React.FC = () => {
  if (!SFX.enabled) return null;
  return React.createElement(
    React.Fragment,
    null,
    CUES.map((cue, i) =>
      React.createElement(
        Sequence,
        { key: i, from: cueFrame(cue), name: `SFX ${cue.file}`, layout: 'none' as const },
        React.createElement(Audio, { src: staticFile(`sfx/${cue.file}`), volume: cue.volume * SFX.masterVolume }),
      ),
    ),
  );
};
