/**
 * The score: 120 BPM (one beat = 30 frames at 60 fps, so every cut lands
 * on the grid), in D. Each section of the edit gets its own arrangement:
 *
 *   chaos      no key: a dissonant cluster, ticking hats, a heartbeat that
 *              speeds the chest up, tape-stops dead on the freeze
 *   beat       silence, then an airy Dmaj9 opening up around the light
 *   structure  chords arrive with the hierarchy: pad, plucked arpeggio, sub
 *   workflow   the groove: four-on-the-floor, claps, bass, 16th arps
 *   dashboard  same groove, brighter (bell octave), snare roll into…
 *   close      one big Dmaj9 and a long tail under the logo
 */
import { ad, asr, biquad, declick, gainOf, len, mtof, noise, place, saw, shape, sine, softclip, SR, stereo, sum, type Stereo } from './dsp.ts';
import type { Section } from '../../src/timeline/cues.ts';

export const BEAT = 0.5;

export type Part = { type: Section; start: number; end: number };

// Dmaj9 – Bm9 – Gmaj9#11 – A6sus, one bar (2 s) each.
const CHORDS = [
  { root: 38, pad: [50, 57, 61, 64, 66] },
  { root: 35, pad: [47, 54, 57, 61, 62] },
  { root: 31, pad: [43, 50, 54, 57, 61] },
  { root: 33, pad: [45, 52, 54, 59, 62] },
];
const ARP = [0, 2, 1, 3, 4, 3, 1, 2];

const kick = (gain = 1) => softclip(shape(sum(sine(0.42, (t) => 44 + 120 * Math.exp(-t * 32)), gainOf(shape(biquad(noise(0.02, 7), 'hp', 2000), ad(0.0005, 0.004)), 0.25)), ad(0.001, 0.12)), 1.4).map((v) => v * gain) as Float32Array;
const clap = (seed: number) => {
  const x = new Float32Array(len(0.3));
  [0, 0.011, 0.023].forEach((o, i) => {
    const b = shape(biquad(noise(0.25, seed + i), 'bp', 1300, 1.1), ad(0.0005, i === 2 ? 0.07 : 0.008));
    const k = Math.round(o * SR);
    for (let j = 0; j < b.length && k + j < x.length; j++) x[k + j] += b[j];
  });
  return x;
};
const hat = (open: boolean, seed: number) => shape(biquad(noise(open ? 0.3 : 0.06, seed), 'hp', 7500), ad(0.0008, open ? 0.08 : 0.014));
const pluck = (m: number, dur = 0.5) => {
  const f = mtof(m);
  const x = new Float32Array(len(dur));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 6; h++) v += (Math.sin(2 * Math.PI * f * h * t) / h) * Math.exp(-t * (6 + h * 5));
    x[i] = v * Math.min(1, t / 0.002);
  }
  return declick(x, 2);
};
const bassNote = (m: number, dur: number) => {
  const f = mtof(m);
  const x = sum(sine(dur, f), gainOf(sine(dur, f * 2), 0.25));
  return softclip(shape(x, asr(0.006, dur, 0.06)), 1.3);
};
const pad = (notes: number[], dur: number, cutoff: number, attack = 0.4, release = 0.9) => {
  const s = stereo(dur + release);
  notes.forEach((m, k) => {
    const f = mtof(m);
    const l = sum(saw(dur + release, f * 0.997, k * 0.13), saw(dur + release, f * 1.004, k * 0.37));
    const r = sum(saw(dur + release, f * 1.003, k * 0.51), saw(dur + release, f * 0.996, k * 0.77));
    const env = (t: number) => Math.min(1, t / attack) * (t < dur ? 1 : Math.exp(-(t - dur) / (release / 3)));
    const lf = shape(biquad(l, 'lp', cutoff, 0.6), env);
    const rf = shape(biquad(r, 'lp', cutoff, 0.6), env);
    for (let i = 0; i < lf.length; i++) {
      s.L[i] += lf[i] * 0.06;
      s.R[i] += rf[i] * 0.06;
    }
  });
  return s;
};
const addStereo = (bus: Stereo, t: number, s: Stereo, g: number) => {
  const o = Math.round(t * SR);
  for (let i = 0; i < s.L.length; i++) {
    const j = o + i;
    if (j < 0 || j >= bus.L.length) continue;
    bus.L[j] += s.L[i] * g;
    bus.R[j] += s.R[i] * g;
  }
};

/** Render the score. Returns the dry music and the reverb send. */
export const renderScore = (parts: Part[], total: number) => {
  const dry = stereo(total + 3);
  const send = stereo(total + 3);
  const both = (t: number, x: Float32Array, g: number, pan: number, rev: number) => {
    place(dry, t, x, g, pan);
    if (rev > 0) place(send, t, x, g * rev, pan);
  };
  const bothS = (t: number, s: Stereo, g: number, rev: number) => {
    addStereo(dry, t, s, g);
    if (rev > 0) addStereo(send, t, s, g * rev);
  };
  // Chords count bars from where harmony first enters.
  const harmonyStart = parts.find((p) => p.type === 'structure' || p.type === 'workflow' || p.type === 'dashboard')?.start ?? 0;
  const chordAt = (t: number) => CHORDS[((Math.floor((t - harmonyStart + 1e-6) / (4 * BEAT)) % 4) + 4) % 4];

  parts.forEach((part, pi) => {
    const { start, end } = part;
    const d = end - start;
    const beats = Math.round(d / BEAT);
    const next = parts[pi + 1]?.type;
    switch (part.type) {
      case 'chaos': {
        // Cluster pad, swelling and opening with the alarm.
        const cl = pad([50, 51, 57, 58, 63], d, 900, Math.min(2, d * 0.5), 0.05);
        const cutoffRamp = biquad(cl.L, 'lp', (t) => 400 + 2400 * Math.min(1, t / d));
        const cutoffRampR = biquad(cl.R, 'lp', (t) => 400 + 2400 * Math.min(1, t / d));
        const swell = (t: number) => Math.min(1, t / (d * 0.6));
        bothS(start, { L: shape(cutoffRamp, swell), R: shape(cutoffRampR, swell) }, 1.0, 0.25);
        // Heartbeat that quickens, and ticking 16ths that thicken.
        let t = 0;
        let k = 0;
        while (t < d - 0.1) {
          both(start + t, kick(0.55), 0.55, 0, 0);
          both(start + t + 0.16, kick(0.3), 0.35, 0, 0);
          const gap = BEAT * (1 - 0.35 * (t / d));
          t += gap;
          k += 1;
        }
        for (let s16 = 0; s16 < beats * 4; s16++) {
          const tt = s16 * (BEAT / 4);
          const dens = tt / d;
          if (s16 % 2 === 1 && dens < 0.35) continue;
          both(start + tt, hat(false, 100 + s16), 0.12 + 0.18 * dens, s16 % 2 ? 0.4 : -0.4, 0.05);
        }
        // Low drone.
        both(start, shape(sum(sine(d, mtof(26)), gainOf(sine(d, mtof(27)), 0.6)), (q) => Math.min(1, q / 1.5) * 0.5), 0.6, 0, 0);
        break;
      }
      case 'beat': {
        // Silence after the freeze, then light: an airy Dmaj9 up high.
        const air = pad([62, 69, 73, 76, 78], d - 0.5, 3200, 1.4, 1.2);
        bothS(start + 0.55, air, 0.9, 0.9);
        both(start + 0.55, shape(sine(d, mtof(26)), (q) => Math.min(1, q / 1.5) * Math.min(1, (d - q) / 0.3) * 0.4), 0.7, 0, 0);
        // Reverse cymbal into whatever comes next.
        if (next) {
          const rc = biquad(noise(1.2, 33), 'hp', 5000);
          both(end - 1.2, shape(rc, (q) => Math.pow(q / 1.2, 3) * 0.5), 0.45, 0, 0.4);
        }
        break;
      }
      case 'structure':
      case 'workflow':
      case 'dashboard': {
        const full = part.type !== 'structure';
        const bright = part.type === 'dashboard';
        for (let b = 0; b < beats; b++) {
          const t = start + b * BEAT;
          const bar = Math.floor((t - harmonyStart + 1e-6) / (4 * BEAT));
          const beatInBar = Math.round((t - harmonyStart) / BEAT) % 4;
          const ch = chordAt(t);
          // Pad + sub on each bar line (or at the section start).
          if (beatInBar === 0 || b === 0) {
            const barLeft = Math.min(4 - beatInBar, beats - b) * BEAT;
            bothS(t, pad(ch.pad, barLeft, full ? 2200 : 1500, b === 0 && !full ? 0.8 : 0.08, 0.5), full ? 0.75 : 0.9, 0.5);
            if (!full) both(t, shape(sine(barLeft, mtof(ch.root)), asr(0.05, barLeft, 0.1)), 0.35, 0, 0);
          }
          // Drums.
          const lastBeat = b === beats - 1;
          if (full) {
            if (!(bright && lastBeat)) both(t, kick(), 0.85, 0, 0);
            if (beatInBar % 2 === 1) both(t, clap(200 + b), 0.32, 0.1, 0.25);
            both(t + BEAT / 2, hat(true, 300 + b), 0.13, 0.3, 0.1);
            both(t, hat(false, 400 + b), 0.1, -0.3, 0);
            both(t + BEAT / 4, hat(false, 500 + b), 0.06, -0.2, 0);
            both(t + (3 * BEAT) / 4, hat(false, 600 + b), 0.07, 0.25, 0);
          } else if (bar >= 1 && beatInBar % 2 === 0) {
            both(t, kick(0.6), 0.5, 0, 0);
          }
          // Bass.
          if (full) {
            [0, 0.5].forEach((o, i) => both(t + o * BEAT, bassNote(ch.root + (i === 1 && beatInBar === 3 ? 12 : 0), BEAT * 0.45), 0.42, 0, 0));
          }
          // Arpeggio: 8ths in structure, 16ths in the groove.
          const steps = full ? 4 : 2;
          for (let s = 0; s < steps; s++) {
            const idx = ARP[(b * steps + s) % ARP.length];
            const m = ch.pad[idx] + 12;
            const tt = t + (s * BEAT) / steps;
            const g = full ? 0.15 : 0.12 + 0.1 * Math.min(1, (t - start) / d);
            both(tt, pluck(m, 0.45), g, (s % 2 ? 0.45 : -0.45), 0.45);
            if (bright && s % 2 === 0) both(tt, pluck(m + 12, 0.5), 0.07, s % 4 ? 0.6 : -0.6, 0.6);
          }
          // Snare roll into the close on the dashboard's last bar.
          if (bright && next === 'close' && (end - t) <= 4 * BEAT + 1e-6) {
            for (let r = 0; r < 4; r++) both(t + (r * BEAT) / 4, clap(700 + b * 4 + r), 0.06 + 0.22 * (1 - (end - t) / (4 * BEAT)), 0, 0.3);
          }
        }
        break;
      }
      case 'close': {
        const ch = CHORDS[0];
        bothS(start, pad([...ch.pad, 69, 74], d - 0.6, 2600, 0.02, 2.2), 1.0, 0.8);
        both(start, shape(sine(d, mtof(38 - 12)), (q) => Math.exp(-q / 1.4) * 0.8), 0.6, 0, 0);
        both(start, kick(1), 0.9, 0, 0.3);
        break;
      }
    }
  });

  // The chaos stops dead on the freeze: a tape-stop on the last 0.35 s.
  parts.forEach((p, i) => {
    if (p.type !== 'chaos' || !parts[i + 1]) return;
    const end = Math.round(p.end * SR);
    const n = Math.round(0.35 * SR);
    for (const ch of [dry.L, dry.R, send.L, send.R]) {
      const src = ch.slice(end - n, end);
      let pos = 0;
      for (let j = 0; j < n; j++) {
        const rate = 1 - j / n;
        const k = Math.floor(pos);
        ch[end - n + j] = (src[Math.min(n - 1, k)] ?? 0) * (1 - j / n);
        pos += rate;
      }
      // Hard stop: nothing rings past the freeze.
      for (let j = end; j < Math.min(ch.length, end + Math.round(0.6 * SR)); j++) ch[j] *= Math.min(1, (j - end) / (0.6 * SR)) ** 4;
    }
  });

  return { dry, send };
};
