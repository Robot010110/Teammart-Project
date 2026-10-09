/**
 * How the real screen recordings are cut into the film. Pure module (no
 * React) so the soundtrack generator can put a tap sound exactly where a
 * tap happens on screen.
 *
 * Events come from events.json, written by scripts/record-flows.cjs while
 * it drives the app. A tap is marked just before the script scrolls to and
 * touches the element, so the touch itself lands TAP_DELAY after its mark.
 */
export type ClipId = 'supervisor-assigns' | 'employee-completes-task' | 'supervisor-approves';

export type ClipEvents = { duration: number; events: Record<string, number> };
export type EventsFile = Record<string, Record<string, ClipEvents>>;

export const TAP_DELAY = 0.65;

/** Which parts of each recording to show, in recording seconds. */
export const SEGMENTS: Record<ClipId, (e: Record<string, number>) => [number, number][]> = {
  // Open the form, type the title… then submit and see it in the list.
  'supervisor-assigns': (e) => [
    [e.tapAssignTask + 0.45, e.titleTyped + 0.3],
    [e.tapSubmit + 0.45, e.assigned + 0.3],
  ],
  // Open the task, start it, take the photo, complete.
  'employee-completes-task': (e) => [
    [e.tapTask + 0.45, e.tapStart + 0.2],
    [e.tapStart + 0.5, e.started - 0.3],
    [e.tapCamera + 0.1, e.photoShown + 0.7],
    [e.tapComplete + 0.5, e.done + 0.3],
  ],
  // Open the logged work, approve, save.
  'supervisor-approves': (e) => [[e.tapRow + 0.45, e.approved + 0.6]],
};

/** Sounds inside each clip: [event, offset after it (s), sound]. */
export const CLIP_SOUNDS: Record<ClipId, [string, number, 'tap' | 'shutter' | 'success'][]> = {
  'supervisor-assigns': [
    ['tapAssignTask', TAP_DELAY, 'tap'],
    ['tapSubmit', TAP_DELAY, 'tap'],
    ['assigned', -0.9, 'success'],
  ],
  'employee-completes-task': [
    ['tapTask', TAP_DELAY, 'tap'],
    ['tapStart', TAP_DELAY, 'tap'],
    ['tapCamera', 0.12, 'shutter'],
    ['tapComplete', TAP_DELAY, 'tap'],
    ['done', -0.8, 'success'],
  ],
  'supervisor-approves': [
    ['tapRow', TAP_DELAY, 'tap'],
    ['tapApprove', TAP_DELAY, 'tap'],
    ['tapSave', TAP_DELAY, 'tap'],
  ],
};

export const clipEvents = (all: EventsFile, lang: string, id: ClipId): ClipEvents => (all[lang] ?? all.en)[id] ?? all.en[id];

/** Plan for showing clip `id` across master frames [from, to). */
export const clipPlan = (all: EventsFile, lang: string, id: ClipId, from: number, to: number, fps = 60) => {
  const segs = SEGMENTS[id](clipEvents(all, lang, id).events);
  const total = segs.reduce((n, [a, b]) => n + (b - a), 0);
  return { segs, total, speed: total / ((to - from) / fps) };
};

/** Recording time (s) shown at master frame F, and the master frames where jump cuts fall. */
export const clipTimeAt = (all: EventsFile, lang: string, id: ClipId, from: number, to: number, F: number) => {
  const { segs, total } = clipPlan(all, lang, id, from, to);
  const u = Math.min(1, Math.max(0, (F - from) / (to - from)));
  let tau = u * total;
  let time = segs[segs.length - 1][1];
  const cuts: number[] = [];
  let acc = 0;
  let found = false;
  for (const [a, b] of segs) {
    cuts.push(from + (acc / total) * (to - from));
    if (!found && tau <= b - a) {
      time = a + tau;
      found = true;
    }
    if (!found) tau -= b - a;
    acc += b - a;
  }
  return { time, cuts: cuts.slice(1) };
};

/** Master frame at which recording time `t` is on screen, or null if it was cut. */
export const masterFrameOf = (all: EventsFile, lang: string, id: ClipId, from: number, to: number, t: number) => {
  const { segs, total } = clipPlan(all, lang, id, from, to);
  let acc = 0;
  for (const [a, b] of segs) {
    if (t >= a && t <= b) return from + ((acc + (t - a)) / total) * (to - from);
    acc += b - a;
  }
  return null;
};
