// A second set of briefs, written separately from tests/fixtures/recommend-briefs.v1.json. Expectations come from the
// catalog data (facets, bestFor, notIdealFor) and are deliberately lenient: a miss means a clearly wrong top pick.
// A reported tie (ranking.tied) whose members include an allowed style is accepted, because the engine promises
// to report such ties instead of choosing a silent winner.
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { recommendDesignDirection } from '../src/recommendation/index.js';
import type { ProductContext } from '../src/recommendation/types.js';

const repo = CatalogRepository.load();

interface Case {
  id: string;
  brief: ProductContext;
  /** top-1 (or a style tied with it, when ranking.tied) must be inside this set */
  allowed: string[];
  /** these must never be top-1 */
  forbidden?: string[];
}

const CASES: Case[] = [
  {
    id: 'soc-console',
    brief: {
      productDescription: 'SIEM threat investigation console that analysts keep open for the whole shift',
      productType: 'security-console', tone: ['technical', 'trustworthy'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high',
    },
    allowed: ['runtime-signal', 'quiet-utility', 'platform-core', 'terminal-core'],
    forbidden: ['cyberpunk-glitch', 'fusion-cyber-console'],
  },
  {
    id: 'hospital-shift-scheduler',
    brief: {
      productDescription: 'Shift scheduling tool for hospital nurses with dense tables, used every day',
      productType: 'healthcare-portal', tone: ['calm', 'trustworthy'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high',
    },
    allowed: ['quiet-utility', 'platform-core'],
  },
  {
    id: 'hr-admin',
    brief: {
      productDescription: 'HR admin portal for managing leave requests and approvals, used daily by HR staff',
      productType: 'operational-saas', tone: ['calm', 'trustworthy'], density: 'medium', usageFrequency: 'daily',
    },
    allowed: ['quiet-utility', 'platform-core', 'notion-style', 'runtime-signal'],
  },
  {
    id: 'indie-game-launch',
    brief: {
      productDescription: 'Launch page for an indie pixel-art game; fans visit once to watch the trailer',
      productType: 'campaign', tone: ['playful', 'bold'], density: 'medium', usageFrequency: 'one-off',
    },
    allowed: ['retro-pixel', 'fusion-studio-pixel', 'kinetic-pop', 'fusion-kinetic-brutal', 'y2k-retro', 'fusion-floppy-exe'],
  },
  {
    id: 'meditation-app',
    brief: {
      productDescription: 'Meditation and sleep app with guided sessions that people open every evening',
      productType: 'consumer-app', tone: ['calm'], density: 'low', usageFrequency: 'daily',
    },
    allowed: ['soft-pastel', 'zen-minimalism', 'neumorphism', 'mesh-gradient'],
    forbidden: ['cyberpunk-glitch', 'kinetic-pop', 'brutalist-grid'],
  },
  {
    id: 'toddler-story-app',
    brief: {
      productDescription: 'Illustrated story app for toddlers; parents read along a few times a week',
      productType: 'consumer-app', tone: ['playful', 'calm'], density: 'low', usageFrequency: 'occasional',
    },
    allowed: ['paper-cut', 'soft-pastel', 'claymorphism', 'bento-bloom', 'fusion-clay-aurora'],
    forbidden: ['cyberpunk-glitch', 'brutalist-grid', 'terminal-core'],
  },
  {
    id: 'architecture-studio',
    brief: {
      productDescription: 'Portfolio for an architecture studio showing buildings with large photography',
      productType: 'portfolio', tone: ['editorial', 'premium'], density: 'low', usageFrequency: 'one-off',
    },
    allowed: ['editorial-silence', 'zen-minimalism', 'fusion-noir-metal', 'fusion-quiet-manifesto', 'fusion-soft-inflate', 'swiss-poster', 'midnight-noir'],
  },
  {
    id: 'b2b-saas-marketing',
    brief: {
      productDescription: 'Marketing site for a B2B analytics SaaS with pricing and a demo request form',
      productType: 'campaign', tone: ['trustworthy', 'technical'], density: 'medium', usageFrequency: 'one-off',
    },
    allowed: ['fusion-pure-noir', 'fusion-product-swiss', 'fusion-strict-console', 'brutalist-grid', 'bento-bloom'],
  },
  {
    id: 'law-firm-no-product-type',
    brief: {
      productDescription: 'Website for a law firm with practice areas and partner profiles',
      tone: ['trustworthy', 'premium'],
    },
    allowed: ['editorial-silence', 'midnight-noir', 'fusion-quiet-manifesto', 'zen-minimalism', 'platform-core', 'quiet-utility', 'fusion-pure-noir', 'swiss-poster'],
    forbidden: ['neumorphism', 'claymorphism', 'bento-bloom', 'retro-pixel'],
  },
  {
    id: 'adult-course-platform-no-product-type',
    brief: {
      productDescription: 'Online course platform for adult learners with video lessons and progress tracking',
      tone: ['trustworthy', 'calm'],
    },
    allowed: ['quiet-utility', 'platform-core', 'notion-style', 'soft-pastel', 'bento-bloom', 'editorial-silence', 'runtime-signal'],
    forbidden: ['neumorphism'],
  },
  {
    id: 'podcast-network',
    brief: {
      productDescription: 'Podcast network homepage with episode listings that listeners browse a few times a week',
      productType: 'content-editorial', tone: ['bold', 'editorial'], density: 'medium', usageFrequency: 'occasional',
    },
    allowed: ['duotone-bold', 'brutalist-grid', 'swiss-poster', 'risograph-print', 'fusion-studio-pixel'],
  },
  {
    id: 'trading-terminal',
    brief: {
      productDescription: 'Real-time trading terminal for active traders with order book and charts, used all day',
      productType: 'finance-admin', tone: ['technical', 'trustworthy'], density: 'high', usageFrequency: 'daily', trustSensitivity: 'high',
    },
    allowed: ['quiet-utility', 'platform-core', 'glass-orbit', 'fusion-bento-noir', 'runtime-signal', 'terminal-core'],
    forbidden: ['cyberpunk-glitch', 'soft-pastel', 'claymorphism'],
  },
];

describe('reviewer-authored briefs: sensible top pick', () => {
  for (const c of CASES) {
    it(c.id, () => {
      const r = recommendDesignDirection({ ...c.brief, candidateLimit: 10 }, repo);
      const ranked = r.candidates.map((x) => `${x.styleId} ${x.score.toFixed(2)}`).join(', ');
      const top = r.candidates[0]!.styleId;
      const tiedWithAllowed = r.ranking?.tied === true && c.allowed.includes(r.ranking.runnerUp);
      expect(c.allowed.includes(top) || tiedWithAllowed, `top-1 was ${top} (tied=${r.ranking?.tied}); ranked: ${ranked}`).toBe(true);
      for (const f of c.forbidden ?? []) expect(top, `ranked: ${ranked}`).not.toBe(f);
    });
  }
});
