import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, Plus, RotateCcw, 
  ChevronUp, Zap, Sparkles 
} from 'lucide-react';
import { restTimer } from '../utils/restTimerService';

export const FluidCapsule: React.FC = () => {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(120);
  const [isFinished, setIsFinished] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = restTimer.subscribe((left, total, finished) => {
      setSecondsLeft(left);
      setTotalSeconds(total > 0 ? total : 120);
      setIsFinished(finished);
    });
    return () => unsubscribe();
  }, []);

  // 没有在计时且未到达完成状态时不显示
  if (secondsLeft === 0 && !isFinished) {
    return null;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progressPercent = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100)) : 0;

  return (
    <div className="fixed top-2.5 inset-x-0 mx-auto z-50 flex flex-col items-center pointer-events-none px-4 select-none animate-in fade-in slide-in-from-top-3 duration-200">
      {/* ===================== 顶部流体云微缩胶囊 (Fluid Capsule) ===================== */}
      {!isExpanded ? (
        <div
          onClick={() => setIsExpanded(true)}
          className={`pointer-events-auto cursor-pointer rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-2xl border transition-all duration-300 flex items-center gap-2.5 active:scale-95 ${
            isFinished
              ? 'bg-red-950/90 text-red-100 border-red-500/50 ring-2 ring-red-500/40 animate-bounce'
              : 'bg-black/92 text-white border-white/15 ring-1 ring-black/40 hover:bg-black'
          }`}
          style={{ minWidth: isFinished ? '180px' : '150px' }}
        >
          {/* 左侧头像/哑铃图标 */}
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
            {isFinished ? (
              <Zap className="w-3 h-3 text-red-400 fill-current animate-pulse" />
            ) : (
              <Dumbbell className="w-3 h-3 text-emerald-400" />
            )}
          </div>

          {/* 中间文字与倒计时 */}
          <div className="flex-1 flex items-center justify-center">
            {isFinished ? (
              <span className="text-xs font-black tracking-tight text-red-300 flex items-center gap-1">
                休息完成，开练！
              </span>
            ) : (
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-xs text-slate-400 font-medium font-sans">间歇</span>
                <span className="text-sm font-black tracking-tight text-white">{timeStr}</span>
              </div>
            )}
          </div>

          {/* 右侧流体音浪跳动柱状动画 */}
          <div className="flex items-end gap-0.5 h-3.5 shrink-0 px-0.5">
            {!isFinished ? (
              <>
                <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-3.5" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-1.5" />
              </>
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            )}
          </div>
        </div>
      ) : (
        /* ===================== 展开态：ColorOS 流体云展开控制卡片 ===================== */
        <div
          className="pointer-events-auto w-full max-w-xs bg-black/95 text-white backdrop-blur-3xl rounded-3xl p-4 shadow-2xl border border-white/15 animate-in zoom-in-95 duration-150 space-y-3"
        >
          {/* 顶栏信息与收起按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Dumbbell className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-black text-white tracking-tight block">一加流体云 · 组间间歇</span>
                <span className="text-[10px] text-slate-400 font-mono">后台自动保活计时</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* 大号倒计时显示与进度条 */}
          <div className="text-center py-2">
            <div className={`text-4xl font-black font-mono tracking-tight ${isFinished ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {isFinished ? '休息结束！' : timeStr}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isFinished ? '⚡ 震动提醒中，准备开始下一组力量输出' : `目标间歇 2 分钟 (剩余 ${secondsLeft} 秒)`}
            </p>

            {/* 优雅胶囊进度条 */}
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-300 ${
                  isFinished ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-400 to-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 快捷操作动作按钮行 */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={() => restTimer.addSeconds(30)}
              className="py-2 px-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1 border border-white/10 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" /> 30秒
            </button>

            <button
              type="button"
              onClick={() => restTimer.start(120)}
              className="py-2 px-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1 border border-white/10 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" /> 重置2分
            </button>

            <button
              type="button"
              onClick={() => {
                restTimer.stop();
                setIsExpanded(false);
              }}
              className="py-2 px-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> 开始下组
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
