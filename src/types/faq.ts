/**
 * Protocol FAQ (Phase 19). Every answer is grounded in the Argon README specification and
 * the deployed contracts; copy lives in `src/services/faqData.ts`, rendering in
 * `FaqSection`. Categories double as the filter chips.
 */
export type FaqCategory = 'how-it-works' | 'trading-rules' | 'security-custody' | 'chains-pools';

export const FAQ_CATEGORIES: ReadonlyArray<{ id: FaqCategory; label: string }> = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'trading-rules', label: 'Trading Rules' },
  { id: 'security-custody', label: 'Security & Custody' },
  { id: 'chains-pools', label: 'Chains & Pools' },
];

export interface FaqEntry {
  /** Stable id, also the DOM anchor (`#faq-<id>`). */
  id: string;
  category: FaqCategory;
  question: string;
  /** One paragraph per element; inline code is written as `backticks` and rendered monospace. */
  answer: readonly string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: readonly string[];
}
