import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

/** Real <table>, sticky mono header, 32 px rows, tabular numerals (design.md §4.7). */
export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string | number;
  onRowClick?: ((row: T) => void) | undefined;
  empty?: ReactNode;
  maxHeightClass?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty = 'no rows', maxHeightClass = 'max-h-[60vh]' }: DataTableProps<T>) {
  return (
    <div className={cn('overflow-auto', maxHeightClass)}>
      <table className="w-full border-collapse text-[0.75rem] tabular-nums">
        <thead className="sticky top-0 z-10 bg-surface-1">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('label h-8 whitespace-nowrap px-2 text-left font-normal', c.align === 'right' && 'text-right', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="h-8 px-2 text-text-dim">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cn('h-8 transition-colors hover:bg-surface-2', onRowClick && 'cursor-pointer')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('whitespace-nowrap px-2', c.align === 'right' && 'text-right', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
