import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  disabled = false,
}: SegmentedControlProps<T>) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    if (disabled) return;
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    itemRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx('flex h-12 gap-1 rounded-ctl bg-surface-subtle p-1', disabled && 'opacity-50', className)}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => { itemRefs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 text-sm2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-subtle',
              active
                ? 'border border-line bg-surface font-semibold text-ink'
                : 'font-medium text-ink-3 hover:text-ink-2',
            )}
          >
            {active && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
