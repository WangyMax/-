import { useId, type FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// 全应用统一的底部确认抽屉：替代各处的 window.confirm / alert，
// 安卓 WebView 下表现一致，不会被拦截。
export const ConfirmSheet: FC<ConfirmSheetProps> = ({
  open,
  title,
  description,
  confirmText = '确定',
  danger = true,
  onCancel,
  onConfirm,
}) => {
  const titleId = useId();
  useLockBodyScroll(open);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-0 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-t-sheet bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-sheet animate-sheet-up sm:rounded-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={cx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              danger ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-h2 font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm2 leading-relaxed text-ink-2">{description}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          <Button variant={danger ? 'dangerSolid' : 'primary'} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
