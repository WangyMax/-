import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ctl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2',
        tone === 'danger'
          ? 'text-danger hover:bg-danger-soft active:bg-danger-soft/80'
          : 'text-ink-3 hover:bg-surface-subtle active:bg-surface-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
