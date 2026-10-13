import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

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
  useLockBodyScroll(open);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[max(env(safe-area-inset-top),46px)] animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-sheet-up"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              danger
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all ${
              danger
                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
