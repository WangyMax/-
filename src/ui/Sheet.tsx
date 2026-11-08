import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { IconButton } from './IconButton';
import { cx } from './cx';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === 'Tab' && panelRef.current) {
        const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          panelRef.current.focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cx(
          'flex max-h-[calc(100dvh-56px)] w-full flex-col overflow-hidden rounded-t-sheet bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-sheet outline-none animate-sheet-up sm:rounded-sheet',
          size === 'lg' ? 'max-w-lg' : 'max-w-md',
        )}
      >
        <div aria-hidden="true" className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-line-strong" />
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h2 font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm2 text-ink-2">{description}</p>}
          </div>
          <IconButton label="关闭" onClick={onClose} className="-mr-2 -mt-1">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain modal-scroll">{children}</div>
        {footer && <div className="mt-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
