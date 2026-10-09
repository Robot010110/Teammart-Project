import React from 'react';
import { Composition, Folder } from 'remotion';
import './lib/fonts';
import { TIMING } from './config';
import { Film15, Film6, FilmFull } from './Film';
import { defaultProps, promoSchema, type PromoProps } from './props';
import { EDITS } from './timeline/edits';

const SIZES = {
  '': { width: 1920, height: 1080 },
  Vertical: { width: 1080, height: 1920 },
  Square: { width: 1080, height: 1080 },
} as const;

const FILMS = [
  { folder: 'Master-40s', prefix: 'TeamMartPromo', edit: EDITS.full, component: FilmFull, captions: false },
  { folder: 'Social-15s', prefix: 'TeamMart15', edit: EDITS.cut15, component: Film15, captions: true },
  { folder: 'Social-6s', prefix: 'TeamMart6', edit: EDITS.cut6, component: Film6, captions: true },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {FILMS.map((film) => (
      <Folder key={film.folder} name={film.folder}>
        {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((suffix) => (
          <Composition
            key={suffix}
            id={`${film.prefix}${suffix}`}
            component={film.component as React.FC<PromoProps>}
            schema={promoSchema}
            // Captions default on for social cuts and for the vertical/square master.
            defaultProps={defaultProps({ captions: film.captions || suffix !== '' })}
            durationInFrames={film.edit.frames}
            fps={TIMING.fps}
            {...SIZES[suffix]}
          />
        ))}
      </Folder>
    ))}
    <Folder name="Kurdish">
      {(['', 'Vertical', 'Square'] as const).map((suffix) => (
        <Composition
          key={suffix}
          id={`TeamMartPromoKurdish${suffix}`}
          component={FilmFull}
          schema={promoSchema}
          defaultProps={defaultProps({ lang: 'ckb', captions: suffix !== '' })}
          durationInFrames={EDITS.full.frames}
          fps={TIMING.fps}
          {...SIZES[suffix]}
        />
      ))}
    </Folder>
  </>
);
