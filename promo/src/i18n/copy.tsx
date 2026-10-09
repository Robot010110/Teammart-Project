import React, { createContext, useContext, useMemo } from 'react';
import { getStaticFiles } from 'remotion';
import { COPY, type Copy, type Prospect } from '../config';
import { buildStructure, type Structure } from '../structure/model';
import { COPY_CKB } from './ckb';

export type Lang = 'en' | 'ckb';

const BASE: Record<Lang, Copy> = { en: COPY, ckb: COPY_CKB };

/** Fill {zone}, {market}, {employee}, {company} in every string of the copy. */
const fill = <T,>(value: T, vars: Record<string, string>): T => {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m)) as T;
  if (Array.isArray(value)) return value.map((v) => fill(v, vars)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fill(v, vars)])) as T;
  }
  return value;
};

type FilmText = { copy: Copy; lang: Lang; rtl: boolean; structure: Structure; prospect: Prospect };

const FilmTextContext = createContext<FilmText | null>(null);

export const FilmTextProvider: React.FC<{ lang: Lang; prospect: Prospect; children: React.ReactNode }> = ({ lang, prospect, children }) => {
  const value = useMemo<FilmText>(() => {
    const base = BASE[lang];
    const n = (pattern: string, i: number) => pattern.replace('{n}', String(i + 1));
    const structure = buildStructure(prospect, {
      hq: base.structure.hq,
      zone: (i) => n(base.structure.zonePattern, i),
      market: (i) => n(base.structure.marketPattern, i),
    });
    const fz = structure.nodes[structure.focusZone];
    const fm = structure.nodes[structure.focusMarket];
    const copy = fill(base, { zone: fz.label, market: fm.label, employee: prospect.employee, company: prospect.company });
    return { copy, lang, rtl: lang === 'ckb', structure, prospect };
  }, [lang, prospect]);
  return <FilmTextContext.Provider value={value}>{children}</FilmTextContext.Provider>;
};

const useFilmText = () => {
  const v = useContext(FilmTextContext);
  if (!v) throw new Error('FilmTextProvider missing');
  return v;
};

export const useCopy = () => useFilmText().copy;
export const useLang = () => {
  const { lang, rtl } = useFilmText();
  return { lang, rtl };
};
export const useStructure = () => useFilmText().structure;
export const useProspect = () => useFilmText().prospect;

/**
 * Resolve a `{lang}` asset path (see SCREENS in config.ts) for the current
 * language, falling back to English when that language has no capture yet.
 */
export const useAsset = () => {
  const { lang } = useFilmText();
  return useMemo(() => {
    const files = new Set(getStaticFiles().map((f) => f.name));
    return (pattern: string) => {
      const own = pattern.replace('{lang}', lang);
      return files.has(own) ? own : pattern.replace('{lang}', 'en');
    };
  }, [lang]);
};
