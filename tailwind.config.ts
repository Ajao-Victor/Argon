import type { Config } from 'tailwindcss';

/**
 * Ultraviolet Argon design system (doc/design.md §2).
 * Every color resolves to a CSS custom property declared in src/styles/tokens.css,
 * so components never carry raw hex (CLAUDE.md §3.5).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
        },
        glass: 'var(--glass)',
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
        },
        argon: {
          300: 'var(--argon-300)',
          400: 'var(--argon-400)',
          500: 'var(--argon-500)',
          600: 'var(--argon-600)',
        },
        plasma: {
          400: 'var(--plasma-400)',
          500: 'var(--plasma-500)',
        },
        ion: {
          400: 'var(--ion-400)',
        },
        signal: {
          up: 'var(--signal-up)',
          down: 'var(--signal-down)',
          warn: 'var(--signal-warn)',
          idle: 'var(--signal-idle)',
          soon: 'var(--signal-soon)',
        },
        text: {
          hi: 'var(--text-hi)',
          mid: 'var(--text-mid)',
          lo: 'var(--text-lo)',
          dim: 'var(--text-dim)',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.12em' }],
        data: ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      borderRadius: {
        panel: '6px',
        chip: '4px',
      },
      spacing: {
        // design.md §2.8 scale is the Tailwind default (1=4px … 12=48px); nothing to add.
      },
      boxShadow: {
        glow: '0 0 24px var(--argon-glow)',
        'glow-sm': '0 0 16px var(--argon-glow)',
        'glow-ion': '0 0 16px var(--ion-glow)',
        // design.md §7.2 neon: hover 15px, focus 24px. Transition only, never looping.
        neon: '0 0 15px var(--argon-500)',
        'neon-lg': '0 0 24px var(--argon-500)',
        'neon-up': '0 0 15px var(--signal-up)',
      },
      backdropBlur: {
        glass: '14px',
      },
      keyframes: {
        // New hourId landed: one ring expands from the hero (design.md §3.3)
        'hour-pulse': {
          '0%': { transform: 'scale(0.2)', opacity: '0.9' },
          '100%': { transform: 'scale(3)', opacity: '0' },
        },
        // Error states only: 2-frame RGB split, once (design.md §3.5)
        glitch: {
          '0%, 100%': { transform: 'translate(0)', textShadow: 'none' },
          '33%': {
            transform: 'translate(-1px, 0)',
            textShadow: '1px 0 var(--signal-down), -1px 0 var(--ion-400)',
          },
          '66%': {
            transform: 'translate(1px, 0)',
            textShadow: '-1px 0 var(--signal-down), 1px 0 var(--ion-400)',
          },
        },
        // Idle surfaces breathe slowly (design.md §1.1 principle 2)
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        // Ticker tape: pure CSS transform marquee, duplicated content (design.md §3.4)
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        // Indeterminate tx pending bar (design.md §3.5)
        'pending-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        // Table refresh: one line sweeps top → bottom (design.md §7.2)
        scanline: {
          '0%': { transform: 'translateY(-2px)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(var(--scan-h, 400px))', opacity: '0' },
        },
        // Terminal flicker once on refresh
        flicker: {
          '0%, 100%': { opacity: '1' },
          '30%': { opacity: '0.85' },
          '60%': { opacity: '0.95' },
        },
        // Confirmed tx: border flashes signal-up for 1.2 s
        'confirm-flash': {
          '0%': { boxShadow: '0 0 0 0 var(--signal-up)' },
          '30%': { boxShadow: '0 0 15px 0 var(--signal-up)' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
      },
      animation: {
        'hour-pulse': 'hour-pulse 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        glitch: 'glitch 180ms steps(1) 1',
        breathe: 'breathe 4s ease-in-out infinite',
        ticker: 'ticker 40s linear infinite',
        'pending-bar': 'pending-bar 1.2s ease-in-out infinite',
        scanline: 'scanline 500ms linear 1',
        flicker: 'flicker 220ms steps(3) 1',
        'confirm-flash': 'confirm-flash 1.2s ease-out 1',
      },
    },
  },
  plugins: [],
};

export default config;
