import { describe, expect, it } from 'vitest';

import { FAQ_CATEGORIES } from '@/types/faq';

import { FAQ_ENTRIES, filterFaq } from './faqData';

describe('FAQ knowledge base', () => {
  it('carries the eight protocol questions with unique ids', () => {
    expect(FAQ_ENTRIES).toHaveLength(8);
    expect(new Set(FAQ_ENTRIES.map((e) => e.id)).size).toBe(8);
    expect(FAQ_ENTRIES.map((e) => e.question)).toEqual([
      'What is Argon and what problem does it solve?',
      'How does the hourly 8-hour forecast and remaining-move calculation work?',
      'When does Argon ENTER, HOLD, or EXIT a pool?',
      'What is the 9-hour Warmup and 2-hour Cooldown?',
      'Which chains and pools are supported?',
      'What are Signer Gates (Safe, Balanced, Aggressive, Custom)?',
      'Are my funds safe? Can the AI or Keeper steal my crypto?',
      "How can I verify the AI didn't fake a trade?",
    ]);
  });
  it('every category chip has at least one entry and every entry a known category', () => {
    const ids = new Set(FAQ_CATEGORIES.map((c) => c.id));
    for (const e of FAQ_ENTRIES) expect(ids.has(e.category)).toBe(true);
    for (const c of FAQ_CATEGORIES) expect(filterFaq(c.id).length).toBeGreaterThan(0);
  });
  it('filters cleanly and "all" returns everything in order', () => {
    expect(filterFaq('all')).toBe(FAQ_ENTRIES);
    expect(filterFaq('security-custody').map((e) => e.id)).toEqual(['funds-safety', 'verify-forecast']);
    expect(filterFaq('trading-rules').map((e) => e.id)).toEqual(['enter-hold-exit', 'warmup-cooldown', 'signer-gates']);
    expect(filterFaq('chains-pools').map((e) => e.id)).toEqual(['chains-pools']);
    expect(filterFaq('how-it-works').map((e) => e.id)).toEqual(['what-is-argon', 'hourly-forecast']);
  });
  it('states the protocol numbers from the README', () => {
    const text = FAQ_ENTRIES.flatMap((e) => [...e.answer, ...(e.bullets ?? [])]).join('\n');
    for (const needle of ['|1h| ≥ 1.0%', '|2h| ≥ 2.5%', '|8h| < 2.0%', 'hours 0–8', '2-hour cooldown', '42161', '4663', 'WETH / USDG', 'argon-gate:', 'rebalance()', 'submit(forecastHash, hourId)', '+0.22%']) {
      expect(text, needle).toContain(needle);
    }
  });
});
