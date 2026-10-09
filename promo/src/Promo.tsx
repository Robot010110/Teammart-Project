import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { LOOK } from './config';
import { Background, Dust, Grain, Vignette } from './components/Atmosphere';
import { EASE, ramp } from './lib/motion';
import { SCENES, SceneWindow, TOTAL_FRAMES } from './lib/timing';
import { Beat } from './scenes/Beat';
import { Chaos } from './scenes/chaos/Chaos';
import { Close } from './scenes/Close';
import { DashboardScene } from './scenes/dashboard/DashboardScene';
import { GraphOverlays } from './scenes/graph/GraphOverlays';
import { GraphWorld } from './scenes/graph/GraphWorld';
import { G } from './scenes/graph/timeline';
import { SfxTrack } from './sfx';

/**
 * The whole film. One component drives both the 16:9 master and the 9:16
 * cut — every scene reads useLayout() and adapts.
 *
 * Scenes overlap on purpose (each SceneWindow has pre/post-roll) so the
 * transitions are continuous moves rather than cuts.
 */
export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SCENES;

  // Mood: warm alarm builds through the chaos, accent takes over at the beat.
  const warm = ramp(frame, S.chaos.start + 100, S.beat.start, 0, 1, EASE.in) * (1 - ramp(frame, S.beat.start, S.beat.start + 40, 0, 1, EASE.out));
  const accent = ramp(frame, S.beat.start + 20, S.structure.start, 0.25, 1, EASE.out);
  const fadeOut = LOOK.fadeOutFrames > 0 ? ramp(frame, TOTAL_FRAMES - LOOK.fadeOutFrames, TOTAL_FRAMES - 1, 0, 1, EASE.smooth) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Background accent={accent} warm={warm} />
      <Dust />

      <SceneWindow name="S1 Chaos + snap" from={S.chaos.start} to={S.beat.start + 80}>
        <Chaos />
      </SceneWindow>
      <SceneWindow name="S2 Beat" from={S.beat.start} to={S.structure.start + 40}>
        <Beat />
      </SceneWindow>
      <SceneWindow name="S3–S4 Structure + Workflow" from={S.structure.start} to={G.end}>
        <GraphWorld />
        <GraphOverlays />
      </SceneWindow>
      <SceneWindow name="S5 Dashboard + real product" from={S.dashboard.start - 24} to={S.close.start + 150}>
        <DashboardScene />
      </SceneWindow>
      <SceneWindow name="S6 Close" from={S.close.start} to={S.close.end}>
        <Close />
      </SceneWindow>

      <Grain />
      <Vignette />
      {fadeOut > 0 && <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />}
      <SfxTrack />
    </AbsoluteFill>
  );
};
