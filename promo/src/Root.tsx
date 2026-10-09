import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { TIMING } from './config';
import { TOTAL_FRAMES } from './lib/timing';
import { Promo } from './Promo';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 16:9 master */}
    <Composition id="TeamMartPromo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={TIMING.fps} width={1920} height={1080} />
    {/* 9:16 vertical — same component, layout adapts */}
    <Composition id="TeamMartPromoVertical" component={Promo} durationInFrames={TOTAL_FRAMES} fps={TIMING.fps} width={1080} height={1920} />
  </>
);
