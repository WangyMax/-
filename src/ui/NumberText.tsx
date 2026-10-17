import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export type NumberSize = 'sm' | 'md' | 'lg' | 'metric';

const sizeClasses: Record<NumberSize, string> = {
  sm: 'text-sm2 font-semibold',
  md: 'text-h2 font-semibold',
  lg: 'text-[20px] font-semibold leading-none',
  metric: 'text-metric font-bold',
};

export interface NumberTextProps extends HTMLAttributes<HTMLSpanElement> {
  size?: NumberSize;
}

export function NumberText({ size = 'md', className, ...props }: NumberTextProps) {
  return (
    <span
      className={cx('tabular-nums', sizeClasses[size], className)}
      {...props}
    />
  );
}
