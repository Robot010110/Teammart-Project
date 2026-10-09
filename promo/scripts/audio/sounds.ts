/**
 * Sound effects, synthesised from scratch. Each voice returns mono samples;
 * the generator places them in stereo. Pitch is in semitones.
 */
import type { SoundId } from '../../src/timeline/cues.ts';
import { ad, asr, biquad, declick, gainOf, len, noise, saw, semis, shape, sine, softclip, SR, sum } from './dsp.ts';

const fmBell = (dur: number, f: number, ratio = 3.5, index = 2.2, tau = 0.5) => {
  const x = new Float32Array(len(dur));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const I = index * Math.exp(-t / (tau * 0.6));
    x[i] = Math.sin(2 * Math.PI * f * t + I * Math.sin(2 * Math.PI * f * ratio * t)) * Math.exp(-t / tau);
  }
  return declick(x, 1);
};

const whooshCore = (dur: number, from: number, to: number, seed: number, q = 1.2) => {
  const n = noise(dur, seed);
  const f = (t: number) => from * Math.pow(to / from, Math.min(1, t / dur));
  const env = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t / dur)), 1.6);
  return declick(shape(biquad(n, 'bp', f, q), env), 4);
};

export type Voice = { x: Float32Array; send: number; duck?: number };

/** Render one cue. `dur` (s) is used by sustained sounds. */
export const voice = (sound: SoundId, pitch: number, dur: number, seed: number): Voice => {
  const p = semis(pitch);
  switch (sound) {
    case 'pop': {
      // Message notification: a rounded upward blip.
      const x = sine(0.12, (t) => (520 + 900 * Math.min(1, t / 0.035)) * p);
      return { x: shape(x, ad(0.002, 0.03)), send: 0.15 };
    }
    case 'popHigh':
      return { x: shape(sine(0.09, (t) => (1100 + 800 * Math.min(1, t / 0.02)) * p), ad(0.001, 0.02)), send: 0.15 };
    case 'buzz': {
      // A phone vibrating against a desk.
      const n = new Float32Array(len(0.42));
      for (let i = 0; i < n.length; i++) {
        const t = i / SR;
        n[i] = Math.sign(Math.sin(2 * Math.PI * 155 * t)) * (Math.floor(t / 0.21) % 2 === 0 ? 1 : 0.25);
      }
      return { x: shape(biquad(n, 'lp', 700), asr(0.01, 0.42, 0.05)), send: 0.05 };
    }
    case 'paper':
      return { x: gainOf(whooshCore(0.18, 5000, 1800, seed, 0.8), 0.9), send: 0.1 };
    case 'mail':
      return { x: sum(whooshCore(0.25, 900, 4200, seed, 1), gainOf(shape(sine(0.15, 1600 * p), ad(0.002, 0.04)), 0.3)), send: 0.2 };
    case 'tick':
    case 'wordTick':
    case 'letter': {
      const f = (sound === 'letter' ? 3200 : 2400) * p;
      const click = shape(biquad(noise(0.02, seed), 'hp', 3000), ad(0.0005, 0.003));
      return { x: sum(shape(sine(0.05, f), ad(0.001, 0.008)), gainOf(click, 0.4)), send: 0.25 };
    }
    case 'vibrationBed': {
      // Several phones buzzing out of phase, swelling with the chaos.
      const x = new Float32Array(len(dur));
      for (const [f, period, ph] of [
        [150, 0.62, 0],
        [172, 0.71, 0.3],
        [139, 0.55, 0.5],
      ]) {
        for (let i = 0; i < x.length; i++) {
          const t = i / SR;
          const on = (t / period + ph) % 1 < 0.55 ? 1 : 0;
          x[i] += Math.sign(Math.sin(2 * Math.PI * f * t)) * on * 0.33;
        }
      }
      return { x: shape(biquad(x, 'lp', 600), (t) => Math.pow(Math.min(1, t / dur), 1.8) * Math.min(1, (dur - t) / 0.03)), send: 0.03 };
    }
    case 'heroThud': {
      const body = shape(sine(0.7, (t) => 40 + 70 * Math.exp(-t * 22)), ad(0.002, 0.18));
      const n = shape(biquad(noise(0.3, seed), 'lp', 500), ad(0.001, 0.05));
      return { x: softclip(sum(body, gainOf(n, 0.6)), 1.6), send: 0.3, duck: 0.5 };
    }
    case 'riser': {
      const n = noise(dur, seed);
      const f = (t: number) => 300 * Math.pow(20, Math.min(1, t / dur));
      const tone = saw(dur, (t) => 110 * Math.pow(4, Math.min(1, t / dur)));
      const env = (t: number) => Math.pow(Math.min(1, t / dur), 2.2) * Math.min(1, (dur - t) / 0.01);
      return { x: shape(sum(biquad(n, 'bp', f, 2), gainOf(biquad(tone, 'lp', f), 0.25)), env), send: 0.35 };
    }
    case 'lowHit': {
      const body = shape(sine(2.2, (t) => (33 + 52 * Math.exp(-t * 9)) * p), ad(0.002, 0.55));
      const n = shape(biquad(noise(1.2, seed), 'lp', (t) => 2400 * Math.exp(-t * 6) + 120), ad(0.001, 0.25));
      return { x: softclip(sum(gainOf(body, 1.1), gainOf(n, 0.7)), 1.8), send: 0.45, duck: 0.85 };
    }
    case 'reverseSuck': {
      // A reversed swell — rushes into the point of light.
      const n = biquad(noise(dur, seed), 'bp', (t) => 400 + 6000 * Math.pow(Math.min(1, t / dur), 2), 0.9);
      return { x: shape(n, (t) => Math.pow(Math.min(1, t / dur), 3) * Math.min(1, (dur - t) / 0.004)), send: 0.4 };
    }
    case 'tink':
      return { x: sum(fmBell(2.4, 2093 * p, 1.41, 1.8, 0.7), gainOf(fmBell(2.4, 3136 * p, 1.41, 1.2, 0.5), 0.5)), send: 0.7 };
    case 'whoosh':
      return { x: whooshCore(0.45, 350, 2600, seed), send: 0.25 };
    case 'whooshBig': {
      const a = whooshCore(0.9, 220, 3800, seed, 0.9);
      const b = shape(sine(0.9, (t) => 70 + 50 * Math.sin(Math.PI * t / 0.9)), (t) => Math.sin((Math.PI * t) / 0.9) * 0.3);
      return { x: sum(a, b), send: 0.35, duck: 0.35 };
    }
    case 'bloom': {
      // Soft "whomp" as the light becomes the HQ: sub swell + airy chord.
      const sub = shape(sine(2.4, 36.7), (t) => Math.min(1, t / 0.06) * Math.exp(-t / 0.8));
      const air = shape(biquad(noise(2.4, seed), 'bp', (t) => 3000 - 2200 * Math.min(1, t / 1.2), 0.7), (t) => Math.min(1, t / 0.04) * Math.exp(-t / 0.5));
      const bell = gainOf(fmBell(2.4, 587.3, 2.0, 1.4, 0.9), 0.35);
      return { x: sum(gainOf(sub, 0.9), gainOf(air, 0.35), bell), send: 0.6, duck: 0.6 };
    }
    case 'nodeTick':
      return { x: sum(fmBell(0.5, 880 * p, 2.0, 1.0, 0.12), gainOf(shape(biquad(noise(0.02, seed), 'hp', 4000), ad(0.0005, 0.004)), 0.3)), send: 0.4 };
    case 'shimmer': {
      // Granular sparkle: many tiny bells spread across the duration.
      const x = new Float32Array(len(dur + 0.6));
      const notes = [74, 78, 81, 85, 86, 90, 93];
      for (let g = 0; g < 46; g++) {
        const t0 = (g / 46) * dur;
        const b = fmBell(0.4, 440 * Math.pow(2, (notes[(g * 5) % notes.length] - 69) / 12), 3.0, 0.6, 0.08);
        const o = Math.round(t0 * SR);
        for (let i = 0; i < b.length && o + i < x.length; i++) x[o + i] += b[i] * 0.35;
      }
      return { x, send: 0.7 };
    }
    case 'chime': {
      const f = 659.25 * p;
      return { x: sum(fmBell(2, f, 3.5, 1.6, 0.55), gainOf(fmBell(2, f * 1.5, 3.5, 1.0, 0.4), 0.35)), send: 0.6 };
    }
    case 'zip': {
      const down = pitch < 0;
      const f = (t: number) => (down ? 2400 - 1900 * Math.min(1, t / 0.32) : 500 + 2200 * Math.min(1, t / 0.32)) * 1;
      const tone = shape(sine(0.36, (t) => f(t) * 0.5), (t) => Math.sin((Math.PI * Math.min(1, t / 0.36))) * 0.4);
      return { x: sum(whooshCore(0.36, down ? 4000 : 600, down ? 600 : 4000, seed, 2), tone), send: 0.3 };
    }
    case 'land': {
      const f = 523.25 * p;
      return { x: sum(fmBell(0.8, f, 2.0, 1.2, 0.18), gainOf(shape(sine(0.2, 90), ad(0.002, 0.05)), 0.6)), send: 0.4 };
    }
    case 'phoneIn':
      return { x: sum(whooshCore(0.5, 300, 2400, seed, 1), gainOf(shape(sine(0.5, (t) => 60 + 40 * t), (t) => Math.sin(Math.PI * Math.min(1, t / 0.5))), 0.25)), send: 0.25 };
    case 'phoneOut':
      return { x: whooshCore(0.35, 2600, 500, seed, 1), send: 0.2 };
    case 'tap': {
      // A crisp UI tap.
      const click = shape(biquad(noise(0.03, seed), 'bp', 3500, 1.5), ad(0.0003, 0.004));
      return { x: sum(gainOf(shape(sine(0.04, 1500), ad(0.0005, 0.008)), 0.6), click), send: 0.1 };
    }
    case 'shutter': {
      const c1 = shape(biquad(noise(0.04, seed), 'hp', 1800), ad(0.0005, 0.006));
      const c2 = shape(biquad(noise(0.05, seed + 1), 'hp', 1200), ad(0.0005, 0.01));
      const x = new Float32Array(len(0.14));
      x.set(c1, 0);
      const o = Math.round(0.07 * SR);
      for (let i = 0; i < c2.length && o + i < x.length; i++) x[o + i] += c2[i] * 0.8;
      return { x, send: 0.15 };
    }
    case 'success': {
      const a = fmBell(0.6, 1046.5, 2.0, 0.8, 0.12);
      const b = fmBell(0.8, 1568, 2.0, 0.8, 0.18);
      const x = new Float32Array(len(0.95));
      x.set(gainOf(a, 0.7), 0);
      const o = Math.round(0.09 * SR);
      for (let i = 0; i < b.length && o + i < x.length; i++) x[o + i] += b[i] * 0.7;
      return { x, send: 0.4 };
    }
    case 'ding': {
      // THE approval: bright two-note confirmation over a soft sub thump.
      const hi = sum(fmBell(2.6, 1318.5, 3.5, 1.4, 0.7), gainOf(fmBell(2.6, 1975.5, 3.5, 1.0, 0.6), 0.6));
      const sub = shape(sine(0.8, (t) => 55 + 30 * Math.exp(-t * 20)), ad(0.002, 0.16));
      return { x: sum(hi, gainOf(sub, 0.8)), send: 0.6, duck: 0.7 };
    }
    case 'rise': {
      // Arpeggio up the octave: the news travelling to the zone, then HQ.
      const x = new Float32Array(len(dur + 1));
      [74, 78, 81, 86, 90].forEach((m, i) => {
        const b = fmBell(1, 440 * Math.pow(2, (m - 69) / 12), 2.0, 0.9, 0.25);
        const o = Math.round(((i / 5) * dur) * SR);
        for (let j = 0; j < b.length && o + j < x.length; j++) x[o + j] += b[j] * 0.5;
      });
      return { x, send: 0.6 };
    }
    case 'swell': {
      const f = 293.66 * p;
      const pad = sum(saw(1.6, f), saw(1.6, f * 1.5 * 1.002), saw(1.6, f * 2.0 * 0.998));
      return { x: shape(biquad(pad, 'lp', (t) => 500 + 2500 * Math.sin(Math.PI * Math.min(1, t / 1.6))), (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 1.6)), 2) * 0.35), send: 0.5 };
    }
    case 'counter': {
      // Rapid ticks that slow down as a number lands.
      const x = new Float32Array(len(dur + 0.1));
      let t = 0;
      let k = 0;
      while (t < dur) {
        const tk = shape(sine(0.03, (2200 + 120 * (k % 4)) * p), ad(0.0005, 0.005));
        const o = Math.round(t * SR);
        for (let j = 0; j < tk.length && o + j < x.length; j++) x[o + j] += tk[j] * 0.5;
        t += 0.025 + 0.11 * Math.pow(t / dur, 2.2);
        k += 1;
      }
      return { x, send: 0.15 };
    }
    case 'sweep': {
      const n = biquad(noise(dur + 0.4, seed), 'bp', (t) => 1500 + 7000 * Math.min(1, t / dur), 3);
      const env = (t: number) => Math.sin(Math.PI * Math.min(1, t / (dur + 0.4)));
      return { x: sum(shape(n, env), gainOf(fmBell(dur + 0.4, 2349, 3.5, 0.8, 0.6), 0.25)), send: 0.6 };
    }
    case 'device':
      return { x: sum(whooshCore(0.4, 500, 3000, seed, 1.4), gainOf(shape(sine(0.2, 110), ad(0.003, 0.05)), 0.4)), send: 0.25 };
    case 'logo': {
      // Crystalline build: a quick arpeggio of the tonic chord.
      const x = new Float32Array(len(2.6));
      [62, 69, 74, 78, 81, 86].forEach((m, i) => {
        const b = fmBell(1.8, 440 * Math.pow(2, (m - 69) / 12), 3.5, 1.2, 0.5);
        const o = Math.round(i * 0.055 * SR);
        for (let j = 0; j < b.length && o + j < x.length; j++) x[o + j] += b[j] * 0.45;
      });
      return { x, send: 0.75 };
    }
    case 'click':
      return { x: sum(shape(sine(0.06, 1800), ad(0.0005, 0.01)), gainOf(shape(sine(0.1, 900), ad(0.001, 0.03)), 0.5)), send: 0.3 };
    case 'tail':
      return { x: shape(biquad(noise(2.2, seed), 'lp', 900), (t) => Math.min(1, t / 0.4) * Math.exp(-t / 0.6) * 0.15), send: 0.8 };
  }
};
