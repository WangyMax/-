import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-2',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-cap font-semibold',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
