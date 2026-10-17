import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-card border border-line bg-surface', className)}
      {...props}
    />
  );
}
