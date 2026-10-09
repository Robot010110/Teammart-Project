import React from 'react';
import { Freeze, OffthreadVideo, staticFile } from 'remotion';
import { SCREENS } from '../../config';
import { useAsset, useLang } from '../../i18n/copy';
import { pulse } from '../../lib/motion';
import { clipPlan as plan, clipTimeAt, type ClipId, type EventsFile } from '../../recordings/clips';
import EVENTS from '../../recordings/events.json';

/**
 * A real screen recording from the app, cut down to its key moments
 * (src/recordings/clips.ts) and fitted to a window of the film. Frames are
 * picked explicitly (<Freeze>) from master time, so the clip stays in sync
 * in every edit, sped up or not.
 */
export type { ClipId };

const FILES: Record<ClipId, string> = {
  'supervisor-assigns': SCREENS.supervisorAssigns,
  'employee-completes-task': SCREENS.employeeCompletes,
  'supervisor-approves': SCREENS.supervisorApproves,
};

const ALL = EVENTS as EventsFile;

export const clipPlan = (lang: string, id: ClipId, from: number, to: number) => plan(ALL, lang, id, from, to);

export const PhoneClip: React.FC<{ id: ClipId; F: number; from: number; to: number }> = ({ id, F, from, to }) => {
  const { lang } = useLang();
  const asset = useAsset();
  const { time, cuts } = clipTimeAt(ALL, lang, id, from, to, F);
  // A quick light flash hides each jump cut inside the recording.
  const flash = Math.max(0, ...cuts.map((c) => pulse(F, c - 2, c + 6, 0.3)));
  return (
    <>
      <Freeze frame={Math.max(0, Math.round(time * 60))}>
        <OffthreadVideo src={staticFile(asset(FILES[id]))} muted style={{ width: 390, height: 844, display: 'block' }} />
      </Freeze>
      {flash > 0.01 && <div style={{ position: 'absolute', inset: 0, background: '#FFFFFF', opacity: 0.35 * flash }} />}
    </>
  );
};
