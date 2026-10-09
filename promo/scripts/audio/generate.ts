/**
 * Generate the soundtrack for every edit of the film:
 *
 *   npm run audio                      # all edits, English + Kurdish
 *   npm run audio -- --prospect prospects/acme.json
 *
 * Writes public/audio/<edit>.m4a and <edit>-ckb.m4a (48 kHz AAC, normalised to
 * −14 LUFS / −1.5 dBTP with ffmpeg's loudnorm), plus music/SFX stems in
 * out/audio-stems/ for checking the mix.
 *
 * Everything is synthesised here — no samples, no licences. The cue sheet
 * (src/timeline/cues.ts) comes from the same beats as the picture, the
 * score follows the edit's sections on a 120 BPM grid, and the cutdowns get
 * their own arrangement instead of a chopped-up master.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, DEFAULT_PROSPECT, type Copy, type Prospect } from '../../src/config.ts';
import { COPY_CKB } from '../../src/i18n/ckb.ts';
import type { EventsFile } from '../../src/recordings/clips.ts';
import { buildStructure } from '../../src/structure/model.ts';
import { buildCues, type Section } from '../../src/timeline/cues.ts';
import { EDITS, masterToOutput, shotStart, type Edit, type EditId } from '../../src/timeline/edits.ts';
import { FPS, SCENE_ORDER, SCENES } from '../../src/timeline/master.ts';
import { freeverb, limit, place, SR, stereo, wavFloat, type Stereo } from './dsp.ts';
import { renderScore, type Part } from './score.ts';
import { voice } from './sounds.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'public', 'audio');
const STEMS = path.join(ROOT, 'out', 'audio-stems');
const events = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'recordings', 'events.json'), 'utf8')) as EventsFile;

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const prospect: Prospect = arg('--prospect') ? { ...DEFAULT_PROSPECT, ...JSON.parse(fs.readFileSync(arg('--prospect')!, 'utf8')) } : DEFAULT_PROSPECT;

const sceneOf = (master: number): Section => SCENE_ORDER.find((k) => master >= SCENES[k].start && master < SCENES[k].end) ?? 'close';

/** The edit's music sections in output seconds, merged when consecutive shots share a scene. */
const partsFor = (edit: Edit): Part[] => {
  if (edit.id === 'full') return SCENE_ORDER.map((k) => ({ type: k, start: SCENES[k].start / FPS, end: SCENES[k].end / FPS }));
  const parts: Part[] = [];
  edit.shots.forEach((s, i) => {
    const type = sceneOf(s.from);
    const start = shotStart(edit, i) / FPS;
    const end = shotStart(edit, i + 1) / FPS;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.end = end;
    else parts.push({ type, start, end });
  });
  return parts;
};

const shotSpeedAt = (edit: Edit, master: number) => edit.shots.find((s) => master >= s.from && master < s.to)?.speed ?? 1;

const render = (id: EditId, lang: 'en' | 'ckb') => {
  const edit = EDITS[id];
  const total = edit.frames / FPS;
  const copy: Copy = lang === 'ckb' ? COPY_CKB : COPY;
  const structure = buildStructure(prospect, {
    hq: copy.structure.hq,
    zone: (i) => copy.structure.zonePattern.replace('{n}', String(i + 1)),
    market: (i) => copy.structure.marketPattern.replace('{n}', String(i + 1)),
  });

  const sfx = stereo(total + 3);
  const send = stereo(total + 3);
  const ducks: { t: number; amount: number }[] = [];

  const play = (t: number, sound: Parameters<typeof voice>[0], gain: number, pan: number, pitch: number, dur: number, seed: number) => {
    const v = voice(sound, pitch, dur, seed);
    place(sfx, t, v.x, gain, pan);
    if (v.send > 0) place(send, t, v.x, gain * v.send, pan);
    if (v.duck) ducks.push({ t, amount: v.duck * Math.min(1, gain * 1.2) });
  };

  // Picture cues, re-timed through the edit (cut ones are dropped).
  buildCues(copy, structure, events, lang).forEach((c, i) => {
    const out = masterToOutput(edit, c.frame);
    if (out === null) return;
    const speed = shotSpeedAt(edit, c.frame);
    play(out / FPS, c.sound, c.gain, c.pan ?? 0, c.pitch ?? 0, (c.dur ?? 0) / FPS / speed, 1000 + i);
  });
  // Every cut of a cutdown gets a whoosh; flash cuts a bright hit too.
  edit.shots.forEach((s, i) => {
    if (i === 0) return;
    const t = shotStart(edit, i) / FPS;
    play(t - 0.12, 'whoosh', 0.32, 0, 0, 0, 50 + i);
    if (s.enter === 'flash') play(t - 0.02, 'tink', 0.3, 0, 5, 0, 60 + i);
  });

  const { dry, send: musicSend } = renderScore(partsFor(edit), total);

  // Duck the music under the big hits so they read.
  const n = dry.L.length;
  const duck = new Float32Array(n).fill(1);
  ducks.forEach(({ t, amount }) => {
    const a = Math.round(t * SR);
    const depth = 1 - 0.5 * amount;
    for (let j = Math.max(0, a - 480); j < Math.min(n, a + Math.round(0.9 * SR)); j++) {
      const dt = (j - a) / SR;
      const g = dt < 0 ? 1 - (1 - depth) * (1 + dt / 0.01) : dt < 0.15 ? depth : depth + (1 - depth) * Math.min(1, (dt - 0.15) / 0.75);
      duck[j] = Math.min(duck[j], g);
    }
  });

  const verbIn: Stereo = { L: new Float32Array(n), R: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    verbIn.L[i] = send.L[i] + musicSend.L[i] * duck[i];
    verbIn.R[i] = send.R[i] + musicSend.R[i] * duck[i];
  }
  const verb = freeverb(verbIn, 0.84, 0.3);

  const N = Math.round(total * SR);
  const mix = stereo(total);
  const musicStem = stereo(total);
  for (let i = 0; i < N; i++) {
    const fade = Math.min(1, (N - i) / (0.3 * SR));
    musicStem.L[i] = dry.L[i] * duck[i] * 0.8;
    musicStem.R[i] = dry.R[i] * duck[i] * 0.8;
    mix.L[i] = (musicStem.L[i] + sfx.L[i] + verb.L[i] * 0.45) * fade;
    mix.R[i] = (musicStem.R[i] + sfx.R[i] + verb.R[i] * 0.45) * fade;
  }
  limit(mix, 0.9);

  const name = `${id}${lang === 'ckb' ? '-ckb' : ''}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-audio-'));
  const raw = path.join(tmp, 'mix.wav');
  fs.writeFileSync(raw, wavFloat(mix));
  // Two-pass loudnorm: measure, then normalise with the measured values.
  const target = 'I=-14:TP=-1.5:LRA=11';
  const measured = (() => {
    try {
      return JSON.parse(execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${raw}" -af loudnorm=${target}:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`], { encoding: 'utf8' }));
    } catch {
      return null;
    }
  })();
  const second = measured
    ? `loudnorm=${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
    : `loudnorm=${target}`;
  fs.mkdirSync(OUT, { recursive: true });
  // AAC at 256 kb/s: transparent for this material at a fraction of WAV's size.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', second, '-ar', String(SR), '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', path.join(OUT, `${name}.m4a`)]);

  fs.mkdirSync(STEMS, { recursive: true });
  fs.writeFileSync(path.join(STEMS, `${name}-music.wav`), wavFloat(musicStem));
  const sfxStem = stereo(total);
  sfxStem.L.set(sfx.L.subarray(0, N));
  sfxStem.R.set(sfx.R.subarray(0, N));
  fs.writeFileSync(path.join(STEMS, `${name}-sfx.wav`), wavFloat(sfxStem));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`public/audio/${name}.m4a  ${total.toFixed(1)} s  ${partsFor(edit).map((p) => `${p.type} ${p.start.toFixed(1)}–${p.end.toFixed(1)}`).join(' · ')}`);
};

const only = arg('--edit') as EditId | undefined;
for (const lang of ['en', 'ckb'] as const) {
  for (const id of Object.keys(EDITS) as EditId[]) {
    if (only && id !== only) continue;
    render(id, lang);
  }
}
