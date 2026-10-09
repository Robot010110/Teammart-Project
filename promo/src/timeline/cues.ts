/**
 * The sound-design cue sheet, in master frames. Every cue is computed from
 * the same beats the picture uses (scene clocks, the 3D beat sheet, the
 * chaos cast, the recordings' tap events), so the soundtrack generator
 * (scripts/audio/generate.ts) lands each sound on the frame its picture
 * does — and moves with it if timing changes.
 *
 * Pure module: no React, no Remotion.
 */
import type { Copy } from '../config.ts';
import { castList } from '../scenes/chaos/cast.ts';
import { B3, B4 } from '../scenes/graph3d/beats.ts';
import { CLIP_SOUNDS, masterFrameOf, type ClipId, type EventsFile } from '../recordings/clips.ts';
import type { Structure } from '../structure/model.ts';
import { sceneClock, SCENES } from './master.ts';

export type SoundId =
  | 'pop'
  | 'popHigh'
  | 'buzz'
  | 'paper'
  | 'mail'
  | 'tick'
  | 'vibrationBed'
  | 'heroThud'
  | 'riser'
  | 'lowHit'
  | 'reverseSuck'
  | 'tink'
  | 'wordTick'
  | 'whoosh'
  | 'whooshBig'
  | 'bloom'
  | 'nodeTick'
  | 'shimmer'
  | 'chime'
  | 'zip'
  | 'land'
  | 'phoneIn'
  | 'phoneOut'
  | 'tap'
  | 'shutter'
  | 'success'
  | 'ding'
  | 'rise'
  | 'swell'
  | 'counter'
  | 'sweep'
  | 'device'
  | 'logo'
  | 'letter'
  | 'click'
  | 'tail';

export type Cue = {
  /** master frame (may be fractional) */
  frame: number;
  sound: SoundId;
  /** linear gain */
  gain: number;
  /** -1 left … 1 right */
  pan?: number;
  /** semitones, for pitched sounds */
  pitch?: number;
  /** length in master frames, for sustained sounds */
  dur?: number;
  note?: string;
};

/** Deterministic pseudo-random in [0, 1) from an integer. */
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const buildCues = (copy: Copy, st: Structure, events: EventsFile, lang: string): Cue[] => {
  const cues: Cue[] = [];
  const add = (c: Cue) => cues.push(c);

  // ── S1 CHAOS ────────────────────────────────────────────────────────
  const c = sceneClock('chaos', 0);
  const stretch = SCENES.chaos.dur / 360;
  const KIND_SOUND = { hero: 'pop', bubble: 'pop', note: 'paper', sheet: 'whoosh', missed: 'buzz', counter: 'tick', email: 'mail', badge: 'popHigh', misc: 'pop' } as const;
  castList(copy.chaos).forEach(([kind, , layer, enter], i) => {
    // Busier and louder as the morning compounds.
    const build = Math.min(1, enter / 300);
    add({
      frame: enter * stretch,
      sound: KIND_SOUND[kind],
      gain: (0.32 + 0.22 * build) * (layer === 2 ? 1.15 : layer === 0 ? 0.7 : 1),
      pan: (hash(i) * 2 - 1) * 0.8,
      pitch: Math.round(hash(i + 40) * 6 - 2),
      note: `${kind} enters`,
    });
  });
  add({ frame: c.at(40), sound: 'vibrationBed', gain: 0.32, dur: SCENES.chaos.end - c.at(40), note: 'phones buzzing, rising with the shake' });
  add({ frame: c.at(200), sound: 'heroThud', gain: 0.7, note: '"who\'s covering…?" slams in' });
  add({ frame: c.at(250), sound: 'riser', gain: 0.4, dur: SCENES.chaos.end - c.at(250), note: 'tension into the freeze' });

  // ── S2 BEAT ─────────────────────────────────────────────────────────
  const B = SCENES.beat.start;
  const b = sceneClock('beat', 0);
  add({ frame: B, sound: 'lowHit', gain: 1, note: 'THE FREEZE' });
  add({ frame: B + b.len(18), sound: 'reverseSuck', gain: 0.75, dur: b.len(44), note: 'everything snaps into the light' });
  add({ frame: B + b.len(60), sound: 'tink', gain: 0.32, note: 'the light flares' });
  let w = 0;
  copy.beat.lines.forEach((line, li) =>
    line.forEach(() => {
      add({ frame: B + b.at(72) + w * b.len(5) + li * b.len(4), sound: 'wordTick', gain: 0.22, pitch: w % 4, pan: (w % 2 ? 0.15 : -0.15) });
      w += 1;
    }),
  );
  add({ frame: B + b.at(162), sound: 'whoosh', gain: 0.4, note: 'words exit' });

  // ── S3 STRUCTURE (3D) ───────────────────────────────────────────────
  add({ frame: B3.hq, sound: 'bloom', gain: 0.85, note: 'the light blooms into HQ' });
  const pops = (level: 1 | 2, gain: number, base: number) =>
    st.nodes
      .filter((n) => n.level === level)
      .forEach((n) => {
        const start = (level === 1 ? B3.zones + n.order * B3.zoneGap : B3.markets + n.order * B3.marketGap) + (level === 1 ? B3.zoneDraw : B3.marketDraw) * 0.72;
        add({ frame: start, sound: 'nodeTick', gain, pitch: base + (n.order % 5) * 2, pan: Math.cos((n.angle * Math.PI) / 180) * 0.7 });
      });
  pops(1, 0.45, 0);
  pops(2, 0.28, 7);
  const lastEmployee = B3.employees + (st.counts.employees - 1) * B3.employeeGap + B3.employeeDraw;
  add({ frame: B3.employees, sound: 'shimmer', gain: 0.4, dur: lastEmployee - B3.employees, note: 'employees ripple in' });
  [B3.admin, B3.rm, B3.sup].forEach((f, i) => add({ frame: f, sound: 'chime', gain: 0.5, pitch: [0, 4, 7][i], note: `role ${i + 1}` }));
  add({ frame: B4.push[0] - 40, sound: 'riser', gain: 0.28, dur: 40, note: 'into the push-in' });

  // ── S4 WORKFLOW (3D + real app) ─────────────────────────────────────
  add({ frame: B4.push[0], sound: 'whooshBig', gain: 0.55, note: 'camera pushes in' });
  const phones: [ClipId, readonly [number, number]][] = [
    ['supervisor-assigns', B4.phoneA],
    ['employee-completes-task', B4.phoneB],
    ['supervisor-approves', B4.phoneC],
  ];
  phones.forEach(([id, [a, z]], i) => {
    add({ frame: a, sound: 'phoneIn', gain: 0.5, pan: 0.35, note: `phone ${i + 1} rises` });
    add({ frame: z - 14, sound: 'phoneOut', gain: 0.35, pan: 0.2 });
    const ev = (events[lang] ?? events.en)[id]?.events ?? events.en[id].events;
    CLIP_SOUNDS[id].forEach(([name, offset, sound]) => {
      if (ev[name] === undefined) return;
      const f = masterFrameOf(events, lang, id, a + 10, z - 10, ev[name] + offset);
      if (f !== null) add({ frame: f, sound, gain: sound === 'success' ? 0.4 : 0.42, pan: 0.3, note: `${id}: ${name}` });
    });
  });
  add({ frame: B4.down[0], sound: 'zip', gain: 0.5, pitch: -3, note: 'task travels to the employee' });
  add({ frame: B4.down[1] - 2, sound: 'land', gain: 0.45 });
  add({ frame: B4.up[0], sound: 'zip', gain: 0.5, pitch: 4, note: 'done — back to the Supervisor' });
  add({ frame: B4.up[1] - 2, sound: 'land', gain: 0.45, pitch: 3 });
  add({ frame: B4.check + 10, sound: 'ding', gain: 0.62, note: 'APPROVED' });
  add({ frame: B4.toZone[0], sound: 'rise', gain: 0.38, dur: B4.toHq[1] - B4.toZone[0], note: 'visible to the zone, then HQ' });
  add({ frame: B4.toZone[1] - 2, sound: 'land', gain: 0.35, pitch: 7 });
  add({ frame: B4.toHq[1] - 2, sound: 'land', gain: 0.35, pitch: 12 });
  add({ frame: B4.pull[0], sound: 'whooshBig', gain: 0.6, note: 'pull back into the dashboard' });

  // ── S5 DASHBOARD ────────────────────────────────────────────────────
  const D = SCENES.dashboard.start;
  const d = sceneClock('dashboard', 0);
  add({ frame: D + d.at(2), sound: 'swell', gain: 0.45, note: 'dashboard settles in' });
  [10, 15.4, 20.8, 26.2].forEach((k, i) => add({ frame: D + d.at(k), sound: 'counter', gain: 0.22, dur: 48, pitch: i * 2, pan: -0.6 + i * 0.4 }));
  [32, 38, 44, 50].forEach((k, i) => add({ frame: D + d.at(k), sound: 'whoosh', gain: 0.18, pan: i % 2 ? 0.4 : -0.4 }));
  add({ frame: D + d.at(170), sound: 'chime', gain: 0.45, pitch: 12, note: 'the approved task lands in the live feed' });
  add({ frame: D + d.at(268), sound: 'whoosh', gain: 0.4, note: 'pull back' });
  add({ frame: D + d.at(292), sound: 'sweep', gain: 0.5, dur: d.len(42), note: 'light sweep reveals the real product' });
  [326, 334.4, 342.8].forEach((k, i) => add({ frame: D + d.at(k), sound: 'device', gain: 0.38, pan: 0.2 + i * 0.25 }));
  add({ frame: D + d.at(420), sound: 'riser', gain: 0.32, dur: SCENES.close.start - (D + d.at(420)), note: 'into the close' });

  // ── S6 CLOSE ────────────────────────────────────────────────────────
  const C = SCENES.close.start;
  const k = sceneClock('close', 0);
  add({ frame: C, sound: 'whooshBig', gain: 0.5, note: 'devices converge to the light' });
  add({ frame: C + k.at(30), sound: 'lowHit', gain: 0.55, pitch: 5, note: 'soft hit as the logo forms' });
  add({ frame: C + k.at(40), sound: 'logo', gain: 0.55, note: 'the mark builds' });
  copy.close.wordmark.join('').split('').forEach((_, i) => add({ frame: C + k.at(80) + i * 2, sound: 'letter', gain: 0.12, pitch: i }));
  add({ frame: C + k.at(130), sound: 'swell', gain: 0.35, pitch: 7, note: 'tagline' });
  add({ frame: C + k.at(190), sound: 'click', gain: 0.4, note: 'call to action' });
  add({ frame: C + k.at(240), sound: 'tail', gain: 0.3 });

  return cues.sort((x, y) => x.frame - y.frame);
};

/** Music sections of the master, by scene. */
export type Section = 'chaos' | 'beat' | 'structure' | 'workflow' | 'dashboard' | 'close';
