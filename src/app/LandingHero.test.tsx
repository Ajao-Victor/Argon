// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/simulation/KeeperAvatar', () => ({ KeeperAvatar: () => <div data-testid="avatar" /> }));
vi.mock('@/hooks/useAgent', () => ({
  agentKeys: { latest: () => ['agent', 'latest'], status: () => ['agent', 'status'] },
  useLatestForecast: () => ({ data: undefined, status: 'pending' }),
  useAgentStatus: () => ({ data: undefined, status: 'pending' }),
  useAgentMode: () => 'offline',
}));

import { LandingHero } from './LandingHero';

afterEach(cleanup);

describe('LandingHero copy', () => {
  it('renders the autopilot headline and subheadline', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LandingHero />
      </QueryClientProvider>,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.replace(/\s+/g, ' ').trim()).toBe('Yield on autopilot. Safety built in.');
    expect(screen.getByText("Argon puts your crypto to work when ETH is calm and puts it to cash when it isn't. No charts, no clicking.")).toBeTruthy();
    expect(screen.getByRole('link', { name: /open the vault/ }).getAttribute('href')).toBe('/app');
  });
});
