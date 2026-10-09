import React, { createContext, useContext } from 'react';
import { sceneClock, SceneKey } from '../timeline/master';

export { FPS, SCENE_ORDER, SCENES, MASTER_FRAMES, sceneClock, beatAt } from '../timeline/master';
export type { SceneKey, SceneRange, SceneClock } from '../timeline/master';

/**
 * Film time. Every scene animates against the *master* timeline (40 s at
 * 60 fps). An edit maps each output frame to a master frame — 1:1 for the
 * full film, sped up or skipped for the cutdowns — so the master frame can
 * be fractional. `step` is how many master frames pass per output frame,
 * which velocity-based motion blur needs.
 */
type FilmTime = { master: number; step: number };

const FilmTimeContext = createContext<FilmTime>({ master: 0, step: 1 });

export const FilmTimeProvider: React.FC<{ value: FilmTime; children: React.ReactNode }> = ({ value, children }) => (
  <FilmTimeContext.Provider value={value}>{children}</FilmTimeContext.Provider>
);

/** Current master frame (may be fractional inside sped-up shots). */
export const useAbsoluteFrame = () => useContext(FilmTimeContext).master;

/** Master frames per output frame — use for "previous frame" velocity math. */
export const useFrameStep = () => useContext(FilmTimeContext).step;

export const useSceneClock = (key: SceneKey) => sceneClock(key, useAbsoluteFrame());

/** Mounts its children only while the master frame is inside [from, to). */
export const SceneWindow: React.FC<{ name: string; from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const f = useAbsoluteFrame();
  return f >= from && f < to ? <>{children}</> : null;
};
