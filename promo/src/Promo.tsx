import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background, Dust } from './components/Atmosphere';
import { EASE, ramp } from './lib/motion';
import { SCENES, SceneWindow, useAbsoluteFrame } from './lib/timing';
import { Beat } from './scenes/Beat';
import { Chaos } from './scenes/chaos/Chaos';
import { Close } from './scenes/Close';
import { DashboardScene } from './scenes/dashboard/DashboardScene';
import { GRAPH_WINDOW } from './scenes/graph3d/beats';
import { GraphScene } from './scenes/graph3d/GraphScene';

/**
 * The 40 s master, scene by scene, on master time. Every cut (40 s, 15 s,
 * 6 s) renders this through <Film/>, which maps output frames to master
 * frames. Scenes overlap on purpose so transitions are continuous moves.
 */
export const MasterScenes: React.FC = () => {
  const frame = useAbsoluteFrame();
  const S = SCENES;

  // Mood: warm alarm builds through the chaos, accent takes over at the beat.
  const warm = ramp(frame, S.chaos.start + 100, S.beat.start, 0, 1, EASE.in) * (1 - ramp(frame, S.beat.start, S.beat.start + 40, 0, 1, EASE.out));
  const accent = ramp(frame, S.beat.start + 20, S.structure.start, 0.25, 1, EASE.out);

  return (
    <AbsoluteFill>
      <Background accent={accent} warm={warm} />
      <Dust />

      <SceneWindow name="S1 Chaos + snap" from={S.chaos.start} to={S.beat.start + 80}>
        <Chaos />
      </SceneWindow>
      <SceneWindow name="S2 Beat" from={S.beat.start} to={S.structure.start + 40}>
        <Beat />
      </SceneWindow>
      <SceneWindow name="S3–S4 3D hierarchy + real workflow" from={GRAPH_WINDOW[0]} to={GRAPH_WINDOW[1]}>
        <GraphScene />
      </SceneWindow>
      <SceneWindow name="S5 Dashboard + real product" from={S.dashboard.start - 24} to={S.close.start + 150}>
        <DashboardScene />
      </SceneWindow>
      <SceneWindow name="S6 Close" from={S.close.start} to={S.close.end}>
        <Close />
      </SceneWindow>
    </AbsoluteFill>
  );
};
