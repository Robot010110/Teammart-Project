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

/**
 * Noto Sans Arabic (variable, weight 100–900) for the Sorani Kurdish cut —
 * the same family the TeamMart app uses for Kurdish. Registered only for the
 * Arabic-script range, so Latin text, digits and the brand keep using Inter.
 * License: public/fonts/OFL-NotoSansArabic.txt.
 */
export const ARABIC_FAMILY = 'Noto Sans Arabic';

loadFont({
  family: ARABIC_FAMILY,
  url: staticFile('fonts/NotoSansArabic-arabic.woff2'),
  weight: '100 900',
  format: 'woff2',
  unicodeRange: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC',
});

/** Inter first; Arabic-script characters fall through to Noto Sans Arabic. */
export const FONT_STACK = `${FONT_FAMILY}, '${ARABIC_FAMILY}', system-ui, sans-serif`;
