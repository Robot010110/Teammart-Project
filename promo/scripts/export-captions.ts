/**
 * Export the burned-in captions as sidecar files, for players and social
 * platforms that take their own (and for accessibility):
 *
 *   npm run captions   →  captions/<edit>.<lang>.srt and .vtt
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY, type CaptionLine } from '../src/config.ts';
import { COPY_CKB } from '../src/i18n/ckb.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'captions');

const stamp = (s: number, sep: ',' | '.') => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}${sep}${pad(ms % 1000, 3)}`;
};

const srt = (lines: CaptionLine[]) => lines.map((l, i) => `${i + 1}\n${stamp(l.from, ',')} --> ${stamp(l.to, ',')}\n${l.text}\n`).join('\n');
const vtt = (lines: CaptionLine[], rtl: boolean) =>
  `WEBVTT\n\n${lines.map((l) => `${stamp(l.from, '.')} --> ${stamp(l.to, '.')}${rtl ? ' align:center' : ''}\n${l.text}\n`).join('\n')}`;

fs.mkdirSync(OUT, { recursive: true });
for (const [lang, copy] of [
  ['en', COPY],
  ['ckb', COPY_CKB],
] as const) {
  for (const [edit, lines] of Object.entries(copy.captions)) {
    // Placeholders in captions are unlikely, but fill the defaults if any.
    fs.writeFileSync(path.join(OUT, `${edit}.${lang}.srt`), srt(lines));
    fs.writeFileSync(path.join(OUT, `${edit}.${lang}.vtt`), vtt(lines, lang === 'ckb'));
    console.log(`captions/${edit}.${lang}.srt / .vtt  (${lines.length} lines)`);
  }
}
