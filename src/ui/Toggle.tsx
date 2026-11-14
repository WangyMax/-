import { cx } from './cx';

export interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** 纯展示的开关轨道，用于整行可点击的设置项（避免在 button 内再嵌套 button）。 */
export function SwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-accent' : 'bg-line-strong',
        className,
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-150',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </span>
  );
}

/** 可独立使用的开关按钮（用药提醒等处沿用）。 */
export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50',
        className,
      )}
    >
      <SwitchTrack checked={checked} />
    </button>
  );
}
