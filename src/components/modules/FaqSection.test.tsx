// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FAQ_ENTRIES } from '@/services/faqData';

import { FaqSection } from './FaqSection';

afterEach(cleanup);

describe('FaqSection', () => {
  it('renders all eight protocol questions as accordion buttons', () => {
    render(<FaqSection />);
    const questions = screen.getAllByRole('button', { expanded: false });
    expect(questions).toHaveLength(8);
    for (const e of FAQ_ENTRIES) expect(screen.getByRole('button', { name: e.question })).toBeTruthy();
  });

  it('filters by category chip and keeps the chips a radiogroup', () => {
    render(<FaqSection />);
    const chips = within(screen.getByRole('radiogroup', { name: 'faq category' })).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(['All', 'How It Works', 'Trading Rules', 'Security & Custody', 'Chains & Pools']);

    fireEvent.click(screen.getByRole('radio', { name: 'Security & Custody' }));
    expect(screen.getByRole('radio', { name: 'Security & Custody' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Are my funds safe? Can the AI or Keeper steal my crypto?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Which chains and pools are supported?' })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Chains & Pools' }));
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(1);

    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(8);
  });

  it('expands one answer at a time with aria-expanded and a labelled region', () => {
    render(<FaqSection />);
    const q = screen.getByRole('button', { name: 'When does Argon ENTER, HOLD, or EXIT a pool?' });
    fireEvent.click(q);
    expect(q.getAttribute('aria-expanded')).toBe('true');
    const region = screen.getByRole('region', { name: 'When does Argon ENTER, HOLD, or EXIT a pool?' });
    expect(region.textContent).toContain('EXIT if');
    expect(region.textContent).toContain('HOLD if already in the pool');

    fireEvent.click(screen.getByRole('button', { name: 'What is Argon and what problem does it solve?' }));
    expect(q.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
  });
});
