# Argon — Design System

Aesthetic brief: a simulation-grade tactical terminal. Black canvas, ultraviolet argon plasma, monospace telemetry, dense data. The reference image in `doc/1000628611.jpg` is a glass tube of ionized argon glowing violet-magenta against black. That is the brand: a sealed vessel, a charged gas, a visible reaction. The vault is the tube. The hourly forecast is the current running through it.

Inspiration set: high-octane trading terminals, sci-fi tactical HUDs, gamified on-chain dashboards (HashPet, WTF), Bloomberg density with Tron light. What we take from them: density, motion that means something, monospace everywhere data lives. What we leave: novelty for its own sake, motion that hides latency, any element that competes with a wallet prompt.

---

## 1. Aesthetic direction

### 1.1 Principles

1. **The number is the hero.** `ethPctChange` is the largest thing on the dashboard. Everything else orbits it.
2. **Motion means state.** A pulse means a new hour landed. A flip means the gate changed. Idle screens breathe slowly; nothing spins without a reason.
3. **Density over whitespace.** Telemetry panels are packed. Labels are small caps and dim. Values are bright and monospace. Padding is 8–12 px inside panels, 16 px between them.
4. **Glass over glow over black.** Three depth layers: the void (pure black with the particle field), glass panels (translucent, blurred, hairline borders), and luminous data (text and chips that emit).
5. **Terminal honesty.** Every hash is shown truncated with a copy affordance. Every timestamp says `UTC`. Every status has a text label. Color is never the only signal.
6. **Reduced motion is a first-class theme,** not a degraded one.

### 1.2 Mood

Cold, charged, precise. The screen should feel like watching a reactor gauge, not a casino. Ultraviolet is the energy color. Magenta is the excitation edge. Cyan is reserved for links and data lineage, so it stays rare and readable.

---

## 2. Color palette and brand tokens

All tokens are CSS custom properties in `src/styles/tokens.css` and mirrored in the Tailwind theme. Components use tokens, never raw hex.

### 2.1 Canvas and surfaces

| Token | Hex | Use |
|---|---|---|
| `--void` | `#000000` | Page background under the particle field |
| `--surface-0` | `#07060B` | Base panel fill |
| `--surface-1` | `#0E0C16` | Elevated panel, table header |
| `--surface-2` | `#16132200` → `#161322` at 100% | Hover and active rows |
| `--glass` | `rgba(14, 12, 22, 0.55)` | Glass panel fill with `backdrop-filter: blur(14px)` |
| `--hairline` | `rgba(192, 132, 252, 0.14)` | Panel borders, table rules |
| `--hairline-strong` | `rgba(192, 132, 252, 0.32)` | Focused panel, active card |

### 2.2 Argon accent ramp (primary)

| Token | Hex | Use |
|---|---|---|
| `--argon-300` | `#D8B4FE` | Text on dark accent, hover glow core |
| `--argon-400` | `#C084FC` | Primary interactive text, active chip text |
| `--argon-500` | `#A855F7` | Primary buttons, hero number, focus ring |
| `--argon-600` | `#7E22CE` | Pressed buttons, deep glow |
| `--argon-glow` | `rgba(168, 85, 247, 0.45)` | `box-shadow` and `text-shadow` glow |
| `--plasma-400` | `#F0ABFC` | Excitation highlight, particle cores |
| `--plasma-500` | `#E879F9` | Ticker separators, hour pulse ring |

### 2.3 Secondary accent

| Token | Hex | Use |
|---|---|---|
| `--ion-400` | `#22D3EE` | Links, explorer anchors, data-lineage lines |
| `--ion-glow` | `rgba(34, 211, 238, 0.35)` | Link hover glow |

### 2.4 Semantic

| Token | Hex | Meaning |
|---|---|---|
| `--signal-up` | `#34D399` | Positive %, `IN_POOL`, hash match, tx confirmed |
| `--signal-down` | `#FB7185` | Negative %, `EXIT`, hash mismatch, tx failed |
| `--signal-warn` | `#FBBF24` | Stale, pending on chain, wrong chain |
| `--signal-idle` | `#8B86A0` | `IDLE`, `UNFUNDED`, disabled |
| `--signal-soon` | `#5B5670` | `LINK_SOON` |

Gate chip is not up/down. `IN` (inside ±2%) uses `--argon-400`. `OUT` uses `--signal-warn`. The sign of the number carries up/down; the gate carries in/out.

### 2.5 Text

| Token | Hex | Use |
|---|---|---|
| `--text-hi` | `#EDEAF6` | Values, headings |
| `--text-mid` | `#B8B3C9` | Body |
| `--text-lo` | `#8B86A0` | Labels, captions, small caps |
| `--text-dim` | `#5B5670` | Placeholders, disabled |

### 2.6 Contrast rules

- `--text-hi` on `--surface-0`: 15:1. `--text-lo` on `--surface-0`: 5.6:1. Nothing below 4.5:1 for text.
- Glow is decorative. The un-glowed text must still pass.
- Semantic colors are always paired with a label or icon.

### 2.7 Typography

| Role | Font | Fallback | Size / tracking |
|---|---|---|---|
| Data, numbers, hashes, tables, tickers | JetBrains Mono | `ui-monospace, SFMono-Regular, Menlo, monospace` | 12–14 px body, `tabular-nums` |
| Hero number and action word | Space Grotesk (`.data-hero`) | `Inter, system-ui` | 72–128 px, weight 500, tracking -0.03em, `tabular-nums`. Changed 2026-09-18: the primary data point uses the display face for hierarchy; every other number stays mono. |
| Secondary labels (`.label-lg`) | JetBrains Mono | same | 12–13 px, uppercase, tracking 0.18em, `--text-lo` |
| Display headings | Space Grotesk | `Inter, system-ui, sans-serif` | 20–32 px, tracking -0.01em |
| Labels | JetBrains Mono | same | 10–11 px, uppercase, tracking 0.12em, `--text-lo` |

Numbers always use `font-variant-numeric: tabular-nums` so ticking values do not shift layout.

### 2.8 Spacing, radii, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Radii: panels 6 px, chips 4 px, buttons 4 px. No pills. HUDs are rectilinear.
- Elevation is glow and hairline, not drop shadow. Active panel: `--hairline-strong` plus `0 0 24px var(--argon-glow)`.

---

## 3. Simulation and animation engine

### 3.1 Tiers and budgets

| Tier | Tool | Budget |
|---|---|---|
| CSS | keyframes, transitions, `transform` only | Free; use for ticker, breathing glow, chip pulse |
| Framer Motion | number roll, chip flip, `AnimatePresence`, `layout` | ≤ 20 animated nodes per route; durations 120–400 ms |
| Canvas 2D | one `<canvas>` behind `/app/*` | ≤ 4 ms per frame; DPR ≤ 2 |
| WebGL shader | optional replacement for the Canvas 2D background | same budget; feature-flagged; Canvas 2D fallback |

Three.js is not in v1. One background does not justify 600 KB.

### 3.2 The particle field (background)

Concept: ionized argon inside the tube. Particles drift slowly with a faint violet trail. Their energy reflects the forecast.

| Input | Effect |
|---|---|
| `|ethPctChange|` | Particle speed. 0% is near-still; 2% is agitated; ≥ 2% is turbulent |
| `gateChip === 'OUT'` | Field tint shifts toward `--signal-warn`; particles pull to edges (liquidity leaving the pool) |
| `gateChip === 'IN'` | Particles converge on a central band (liquidity in range) |
| `warmup` | Low density, slow, no band |
| New `hourId` | One ring pulse from center, 900 ms, `--plasma-500`, then settle |
| `awaitingSignature` | Field freezes (scheduler paused) |
| `prefers-reduced-motion` | Static gradient, no canvas |

Implementation: ≤ 400 particles on desktop, ≤ 150 on mobile. Additive blending via `globalCompositeOperation: 'lighter'`. One `requestAnimationFrame` from `useSimulationLoop`. Props enter through a ref. Cleanup releases the context.

### 3.3 Hour pulse

When the accepted `hourId` increments, a ring expands from the hero number across the dashboard (canvas) and the hero number rolls to its new value (Framer Motion `animate` on a motion value, 600 ms, easeOut). The gate chip flips with a 3D `rotateX` if its value changed. The pool cards re-evaluate one poll later and glow briefly on status change.

### 3.4 Ticker tape

A CSS `transform: translateX` marquee at the top of `/app`. Content: last 12 forecasts as `hourId · ±x.xx% · action`, separated by `--plasma-500` glyphs. Duplicated once for seamless loop. Paused on hover. Pure CSS, no JS interval.

### 3.5 Micro-interactions

| Element | Interaction |
|---|---|
| Button hover | Glow ramps `0 → 0 0 16px var(--argon-glow)` in 120 ms |
| Button press | Scale 0.98, glow to `--argon-600` |
| Chip change | 3D flip, 220 ms |
| Hash copy | Hash text flashes `--ion-400` for 300 ms, tooltip "copied" |
| Row hover | `--surface-2` fill, hairline brightens |
| Tx pending | Thin indeterminate bar in `--argon-500` under the button, not a spinner |
| Tx confirmed | Button text becomes "confirmed", `--signal-up` hairline, 1.2 s, then reset |
| Glitch | Reserved for **error** states only: hash mismatch and agent unreachable. 2-frame RGB split, 180 ms, once. Never decorative |

### 3.6 Sound

Off by default. A single opt-in toggle in the UI store enables three cues: hour pulse (soft click), tx confirmed (short rising tone), error (low tick). Web Audio, generated oscillators, no audio files. Persist the toggle in `localStorage`.

### 3.7 Framer Motion pipeline rules

- Animate `transform` and `opacity` only. Never animate `width`, `height`, `top`, `left`, `filter` on more than one node.
- `layout` animations only inside panels, never on the page grid.
- `AnimatePresence` with `mode="popLayout"` for lists.
- Use `useReducedMotion()` and hand it to every motion component.
- No `whileInView` on `/app`. Everything above the fold animates on data, not on scroll.

---

## 4. Component anatomy and density rules

### 4.1 Panel

```
┌ LABEL ────────────────────────── meta ┐   label: 10px mono caps, --text-lo
│                                        │   fill: --glass, blur 14px
│  content                               │   border: 1px --hairline
│                                        │   radius: 6px, padding: 12px
└────────────────────────────────────────┘   active: --hairline-strong + argon glow
```

### 4.2 Forecast hero

```
┌ ETH · 8H AHEAD ─────────────── hourId 488888 · 16:00 UTC ┐
│                                                           │
│      −2.41%          ◉ OUT   →  EXIT                      │
│      (96–120px)      chip    action                       │
│                                                           │
│  Model expects |ETH| move ≥ 2% over 8h. Positions         │
│  flattened.                                               │
│  spot $2,410.12 · model eth-8h-v1 · gate 2.00%            │
└───────────────────────────────────────────────────────────┘
```

Sign is always shown. Negative in `--signal-down`, positive in `--signal-up`, zero in `--text-hi`. Number in `--argon-glow` text-shadow.

### 4.3 Warmup bar

Eight segments. Filled segments in `--argon-500`, empty in `--surface-1` with hairline. Below: `n / 8 · first decision in hh:mm UTC`. Copy from product §3.5.

### 4.4 Pool card

```
┌ POOL 1 ─────────────────────────── Arbitrum · v3 ┐
│  WETH / USDC                          ● IN_POOL  │
│  idle  1.20 WETH · 2,400.00 USDC                 │
│  last rebalance  0x8f3…a21 ↗   hour 488888       │
└──────────────────────────────────────────────────┘
```

Status dot and label colors from §2.4. `LINK_SOON` cards are 60% opacity, no data rows, one line "LINK — model later".

### 4.5 Hash match

```
┌ ON-CHAIN MATCH ──────────────────────────────────┐
│  api       0xdef0…91c2  ⧉                        │
│  registry  0xdef0…91c2  ⧉   ↗ arbiscan           │
│  bps       −241 · −241                           │
│  ● matches chain                                 │
└──────────────────────────────────────────────────┘
```

States: green match, red mismatch (with glitch once), amber "pending on chain", dim "registry not deployed".

### 4.6 Telemetry readout strip

A single-row strip under the ticker: `AGENT ● ok` · `WARMUP 8/8` · `LAST HOUR 488888` · `NEXT :00 in 23:41` · `ARB ● 42161` · `RH ● 4663`. Each item is label + value in mono. Dots use semantic colors.

### 4.7 Data table (forecasts, activity)

- Real `<table>`, sticky header, `--surface-1` header fill.
- Row height 32 px. Font 12 px mono. Numbers right-aligned, `tabular-nums`.
- Columns for forecasts: `hour`, `UTC`, `pred %`, `real %`, `status`, `action`, `hash`, `tx`.
- Matured rows show `real %` with the same sign colors; pending rows show `—`.
- Row click expands a detail drawer with the full hash-match panel.

### 4.8 Token amount input

Mono input, token symbol as a right-aligned chip, `MAX` as a text button in `--ion-400`. Balance line under the input. Validation message replaces the balance line in `--signal-down`.

### 4.9 Transaction button

Single button that walks the steps: `Approve USDC` → `Deposit` → pending bar → `Confirmed`. Disabled with reason text below when simulation reverts. Never two side-by-side buttons for approve and deposit.

### 4.10 Density rules

- Dashboard grid: 12 columns, 16 px gutters. Hero spans 8, hash match 4. Pool cards 3 each. Warmup full width when visible.
- No panel taller than the viewport on desktop. Scroll happens inside tables, not the page, on `/app`.
- Mobile (≤ 640 px): single column, hero first, ticker stays, particle count drops, telemetry strip wraps to two rows.
- Every panel has a label. No unlabeled boxes.
- Empty states are one line of copy and one action, inside the same panel shape.

---

## 5. Theme and motion settings

The UI store exposes three user settings, persisted in `localStorage`:

| Setting | Values | Default |
|---|---|---|
| `motion` | `full` / `reduced` | follows `prefers-reduced-motion` |
| `field` | `on` / `off` | `on` on desktop, `off` on mobile under 4 GB RAM heuristics |

Sound (§3.6) is not implemented in v1; the `sound` setting is added to the store only when the audio cues ship, not before.

There is no light theme in v1. The page always sets `color-scheme: dark`.

---

## 6. Asset rules

- Icons: Lucide, stroke 1.5, 16 px inline. No icon fonts.
- Logo: a wordmark in Space Grotesk plus a tube glyph (rounded rectangle with three coil lines), drawn as inline SVG using `--argon-500` and `--plasma-400`.
- No raster images on `/app`. The landing page may use one hero render of the tube, WebP, under 200 KB.

---

## 7. Tier-1 Interactivity & Simulation Engine

Added 2026-09-18. This section upgrades §3 from "a background that reacts" to "a system that feels alive". Everything here is presentation. It reads the same hooks as the widgets, introduces no new state, no new thresholds, and no new user actions (product.md §3.8 still holds).

### 7.1 The Keeper Avatar

A visual representation of the off-chain agent: the "brain" of the vault. It is not a mascot. It is an instrument that shows, at a glance, how charged the current forecast is and whether the system is live.

**Form.** A hexagonal reactor core rendered as inline SVG driven by Framer Motion. Two eye slits that track the cursor. Three orbital rings at different radii and speeds. Energy arcs that appear between core and rings as intensity rises. A soft radial halo behind everything, pre-rendered as a radial gradient (never an SVG `filter`, which forces a raster pass every frame).

**Inputs.** `ethPctChange`, `action`, `warmupComplete`, agent reachability, agent mode (`live` | `fixture`), and the pointer position. Nothing else.

**Energy states.** Intensity `k = min(|ethPctChange| / 2, 1.5)`, so the gate is `k = 1`.

| State | Condition | Posture |
|---|---|---|
| `dormant` | agent unreachable, or no forecast | Rings stopped. Eyes closed to a hairline. Halo at 20%. Slow 6 s breathe. |
| `warmup` | `warmupComplete === false` | Rings at 25% speed. Eyes half-open. Halo in `--text-lo`. |
| `calm` | `k < 0.6`, gate `IN` | Rings at base speed. Eyes open, tracking. Halo `--argon-500` at 45%. |
| `charged` | `0.6 ≤ k < 1`, gate `IN` | Rings 2×. Eyes narrow. One energy arc. Halo `--plasma-500`. Core jitters 1 px at 8 Hz. |
| `aggressive` | `k ≥ 1`, gate `OUT` | Rings 3.5× and counter-rotating. Eyes slits, tinted `--signal-warn`. Two to three arcs. Halo `--signal-warn` blended into plasma. Core scale 1.06. |
| `training` | agent mode is `fixture` | Any of the above, but the halo and arcs use `--ion-400` and the core pulses at 1.2 s so nobody mistakes fixture data for live data. |

**Cursor tracking.** One `pointermove` listener on `window` writes to two Framer `MotionValue`s. Springs (`stiffness 120, damping 18`) drive the eye offset and a ±6° tilt of the whole core. Nothing tracks the cursor through React state. On touch devices the avatar idles on a slow figure-eight instead.

**State transitions.** Changing state animates rings, halo color, and eye aperture over 600 ms with `easeOut`. A new `hourId` fires the hour pulse (§3.3) from the avatar's center and a 180 ms glitch on the eyes. An action change to `exit` snaps the eyes to `--signal-warn` first, then eases.

**Placement.** On `/app` the avatar sits in the hero column beside the number. On `/` it is the hero. The particle field's attractor (§7.3) is the avatar's on-screen center, measured by a `ResizeObserver` plus a passive scroll listener, written to a ref.

### 7.2 Micro-interactions and physics

| Interaction | Rule |
|---|---|
| **Magnetic buttons** | Within 48 px of the pointer, the button translates toward it by up to 6 px on a spring (`stiffness 300, damping 20`). Release springs back. Only `transform`. Disabled buttons are not magnetic. |
| **Staggered reveal** | Every panel enters with `opacity 0 → 1` and `y 8 → 0`, children staggered 40 ms. Data values that change (hero number, chips, table cells) reveal character by character over ≤ 240 ms. Never on scroll; only on mount and on data change. |
| **Holographic hover** | Glass panels carry a conic sheen that follows the pointer through two CSS variables (`--mx`, `--my`) written directly to the element in a `pointermove` handler. No React state. The sheen is an `::after` pseudo-element at 12% opacity, `mix-blend-mode: screen`, and it fades over 300 ms on leave. |
| **Click feedback** | `whileTap` scale 0.97, glow to `--argon-600`, 90 ms. A confirmed transaction flashes the button border `--signal-up` for 1.2 s. |
| **Glitch reveal** | Reserved for two moments: a new hourly forecast (the hero number and the ticker) and the error states already listed in §3.5. Three frames of RGB split, 180 ms, once. Never looping. |
| **Scanline on refresh** | When a data table's rows change, a single 1 px line in `--argon-400` at 35% sweeps top to bottom over 500 ms, and the table opacity flickers `1 → 0.85 → 1` once. Keyed on the query `dataUpdatedAt`. |
| **Neon glow** | Interactive elements glow `0 0 15px var(--argon-500)` on hover, `0 0 24px` on focus-visible. Glow is a hover transition, never a continuous animation, because `box-shadow` is not compositor-only. |

### 7.3 Fluid particle field

The field (§3.2) becomes a flow field. Particles follow a smooth vector field built from low-frequency sine terms so motion looks like plasma, not confetti. The field has one attractor: the Keeper Avatar.

| Signal | Effect |
|---|---|
| `|ethPctChange|` | Flow speed and turbulence amplitude |
| Gate `IN` | Attractor strength positive: particles spiral inward and orbit the avatar |
| Gate `OUT` | Attractor strength negative: particles are flung outward |
| `action` changes to `enter` or `exit` | A 1.4 s surge: attractor strength triples, then decays. Particles visibly rush the avatar, then settle. |
| New `hourId` | Ring pulse from the attractor |
| `fixture` mode | Ion tint on 20% of particles |

Budgets are unchanged: ≤ 400 particles desktop, ≤ 150 mobile, DPR ≤ 2, additive blending, one canvas. The field adapts: if the scheduler reports frames over budget, the particle count steps down 10% per second to a floor of 80 until the frame cost recovers.

### 7.4 Performance budget (hard rules)

1. **Continuous animation is `transform` and `opacity` only.** Rings rotate with `rotate`. Eyes move with `translate`. Halo pulses with `opacity` and `scale`. No `filter`, `box-shadow`, `width`, `height`, `top`, `left`, or `background-position` in any looping animation.
2. **One `requestAnimationFrame` for the whole page**, owned by the scheduler in `utils/sim/scheduler.ts`. Framer Motion runs its own internal loop for springs; that is the only exception, and it idles when values settle.
3. **The scheduler's frame budget is 4 ms.** If a frame's subscribers cost more than 4 ms, the next frame is dropped. If the rolling average stays over budget, subscribers are told to degrade (the particle field cuts count).
4. **Canvas pauses** when the document is hidden, when the canvas is outside the viewport (`IntersectionObserver`, 0% threshold), and while any write hook is in `awaitingSignature`.
5. **No Framer `layout` animations on the page grid.** `layout` is allowed only inside a single panel where the panel's size is fixed by its container.
6. **Heavy visual components are `React.memo`** with primitive props. Their inputs enter through refs. A React re-render of the dashboard must not touch the canvas or restart a spring.
7. **Pointer handlers write to refs, `MotionValue`s, or CSS variables.** Never to React state. A `pointermove` that calls `setState` is a bug.
8. **Reduced motion wins.** Under `prefers-reduced-motion` or the user's `motion: reduced` setting: no canvas, no rings, no glitch, no stagger, no magnetism. The avatar renders as a static glyph with the correct state color.

### 7.5 Landing page exception

The landing page keeps its "no wallet code" rule (architecture.md §4.7): no wagmi, no connectors. It gains a query-only provider so the Keeper Avatar can read the latest forecast through the same `useLatestForecast` hook. The canvas particle field stays off the landing page; the avatar's own halo and rings are the landing motion.
