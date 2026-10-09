import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

/**
 * Inter (variable: weight 100–900 + optical size), bundled locally so renders
 * never depend on a network font CDN. With the opsz axis, huge kinetic type
 * automatically gets Inter's tighter "Display" letterforms.
 * License: public/fonts/OFL-Inter.txt (SIL Open Font License 1.1).
 */
export const FONT_FAMILY = 'Inter';

loadFont({
  family: FONT_FAMILY,
  url: staticFile('fonts/InterVariable-latin.woff2'),
  weight: '100 900',
  format: 'woff2',
  unicodeRange:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
});

loadFont({
  family: FONT_FAMILY,
  url: staticFile('fonts/InterVariable-latin-ext.woff2'),
  weight: '100 900',
  format: 'woff2',
  unicodeRange:
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
});

export const FONT_STACK = `${FONT_FAMILY}, system-ui, sans-serif`;
