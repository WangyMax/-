import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerSolid';

export type ButtonSize = 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90 active:bg-ink disabled:bg-ink/40',
  secondary: 'bg-surface-subtle text-ink hover:bg-surface-strong active:bg-surface-strong',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-subtle',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-subtle active:bg-surface-strong',
  danger: 'bg-danger-soft text-danger hover:bg-danger-soft/80',
  dangerSolid: 'bg-danger text-white hover:bg-danger/90',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-body',
  lg: 'h-12 px-5 text-body',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block = false, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ctl font-semibold transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        variantClasses[variant],
        sizeClasses[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  );
});
