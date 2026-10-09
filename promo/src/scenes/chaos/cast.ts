/**
 * The chaos cast — every message, note and alert of S1 with its entry
 * frame. Pure module: the soundtrack generator gives each entry its sound.
 */
import type { Copy } from '../../config.ts';

export type ChaosKind = 'hero' | 'bubble' | 'note' | 'sheet' | 'missed' | 'counter' | 'email' | 'badge' | 'misc';

/** Hand-authored cast: [kind, text, layer, enter frame]. Enter frames are unique. */
export const castList = (c: Copy['chaos']): Array<[ChaosKind, string, 0 | 1 | 2, number]> => {
  const b = c.bubbles;
  return [
    ['hero', c.hero, 1, 2],
    // Wave 1 — the morning starts
    ['bubble', b[0], 1, 12],
    ['missed', c.missedCalls[0], 1, 17],
    ['note', c.notes[0], 1, 23],
    ['bubble', b[1], 1, 28],
    ['badge', c.badges[0], 1, 34],
    ['sheet', 'sheet', 1, 39],
    ['bubble', b[2], 0, 45],
    ['email', c.emails[0], 1, 52],
    ['note', c.notes[1], 2, 58],
    ['bubble', b[3], 1, 65],
    ['counter', c.missedCounterLabel, 1, 71],
    ['misc', c.misc[0], 1, 78],
    ['bubble', b[4], 0, 86],
    ['note', c.notes[2], 1, 93],
    // Wave 2 — it compounds
    ['bubble', b[5], 1, 101],
    ['missed', c.missedCalls[1], 0, 107],
    ['sheet', 'sheet', 0, 112],
    ['bubble', b[6], 1, 118],
    ['badge', c.badges[1], 1, 125],
    ['email', c.emails[1], 0, 131],
    ['bubble', b[7], 2, 136],
    ['note', c.notes[3], 1, 142],
    ['misc', c.misc[1], 1, 149],
    ['bubble', b[8], 1, 155],
    ['badge', c.badges[2], 0, 160],
    ['note', c.notes[4], 0, 166],
    ['bubble', b[9], 1, 173],
    ['missed', c.missedCalls[2], 1, 179],
    ['sheet', 'sheet', 1, 186],
    // Wave 3 — peak noise
    ['bubble', b[10], 1, 192],
    ['email', c.emails[2], 1, 198],
    ['note', c.notes[5], 2, 205],
    ['bubble', b[11], 0, 211],
    ['badge', c.badges[3], 1, 218],
    ['misc', c.misc[2], 0, 224],
    ['bubble', b[12], 1, 231],
    ['note', c.notes[6], 1, 237],
    ['bubble', b[0], 0, 244],
    ['badge', c.badges[4], 1, 251],
    ['bubble', b[3], 2, 258],
    ['bubble', b[6], 0, 266],
    ['note', c.notes[2], 0, 274],
    ['bubble', b[9], 1, 283],
    ['missed', c.missedCalls[0], 0, 292],
  ];
};
