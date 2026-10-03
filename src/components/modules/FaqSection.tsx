'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { SPRING } from '@/components/ui/motion';
import { FAQ_ENTRIES, filterFaq } from '@/services/faqData';
import { FAQ_CATEGORIES, type FaqCategory, type FaqEntry } from '@/types/faq';
import { cn } from '@/utils/cn';
import { rovingRadioKeyDown } from '@/utils/rovingRadio';

/**
 * Protocol FAQ (Phase 19): glass panels on hairline borders, category chips, one
 * accordion per question. Expand/collapse animates height on a wrapper with only
 * opacity + transform on the content, so nothing outside the panel repaints. Buttons
 * carry `aria-expanded` / `aria-controls`; the chips are a radiogroup, so the whole
 * section is keyboard-operable with Tab / Space / Enter.
 */
type Filter = FaqCategory | 'all';
const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [{ id: 'all', label: 'All' }, ...FAQ_CATEGORIES];

/** Inline `code` spans → monospace; the rest is plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded-sm bg-surface-1 px-1 font-mono text-[0.8125em] text-text-hi">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function FaqItem({ entry, open, onToggle, headingId, panelId }: { entry: FaqEntry; open: boolean; onToggle: () => void; headingId: string; panelId: string }) {
  const reduced = useReducedMotion();
  return (
    <li id={`faq-${entry.id}`} className={cn('panel scroll-mt-20 transition-[border-color,box-shadow]', open && 'panel-active border-hairline-strong')}>
      <h3 id={headingId} className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base text-text-hi transition-colors hover:text-argon-300 sm:text-lg"
        >
          <span>{entry.question}</span>
          <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }} transition={reduced ? { duration: 0 } : SPRING.snappy} className="shrink-0 text-text-lo">
            <ChevronDown size={16} strokeWidth={1.5} />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            key="body"
            initial={reduced ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { duration: 0.16 } }}
            transition={reduced ? { duration: 0 } : { height: SPRING.heavy, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <motion.div
              initial={reduced ? false : { y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { ...SPRING.snappy, delay: 0.04 }}
              className="flex flex-col gap-3 border-t border-hairline px-5 pb-5 pt-4 text-[0.875rem] leading-6 text-text-mid"
            >
              {entry.answer.map((p, i) => (
                <p key={i}>
                  <Inline text={p} />
                </p>
              ))}
              {entry.bullets && (
                <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-argon-500">
                  {entry.bullets.map((b, i) => (
                    <li key={i}>
                      <Inline text={b} />
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export interface FaqSectionProps {
  /** Section heading; the eyebrow label above it stays "protocol faq". */
  title?: ReactNode;
  /** Initial chip; "all" by default. */
  initialFilter?: Filter;
  className?: string;
}

export function FaqSection({ title = 'Answers before you deposit', initialFilter = 'all', className }: FaqSectionProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const uid = useId();
  const entries = filterFaq(filter, FAQ_ENTRIES);

  return (
    <section id="faq" aria-labelledby={`${uid}-title`} className={cn('w-full scroll-mt-20', className)}>
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <span className="label-lg">protocol faq</span>
        <h2 id={`${uid}-title`} className="font-display text-2xl text-text-hi sm:text-3xl">
          {title}
        </h2>
      </div>

      <div
        role="radiogroup"
        aria-label="faq category"
        className="mb-5 flex flex-wrap justify-center gap-1.5"
        onKeyDown={(e) =>
          rovingRadioKeyDown(e, (i) => {
            const next = FILTERS[i];
            if (!next) return;
            setFilter(next.id);
            setOpenId(null);
          })
        }
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                setFilter(f.id);
                setOpenId(null);
              }}
              className={cn(
                'inline-flex min-h-10 items-center rounded-chip border px-3 py-1.5 text-label uppercase tracking-[0.12em] transition-colors',
                active ? 'border-argon-500/70 bg-argon-500/10 text-argon-300 shadow-glow-sm' : 'border-hairline text-text-lo hover:border-hairline-strong hover:text-text-hi',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <FaqItem
            key={e.id}
            entry={e}
            open={openId === e.id}
            onToggle={() => setOpenId((cur) => (cur === e.id ? null : e.id))}
            headingId={`${uid}-${e.id}-q`}
            panelId={`${uid}-${e.id}-a`}
          />
        ))}
      </ul>
    </section>
  );
}
