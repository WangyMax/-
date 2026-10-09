import { useEffect, useState, useRef } from 'react';
import { Play, Pause, Plus, X, Bell } from 'lucide-react';

interface RestTimerProps {
  initialSeconds?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const RestTimerModal: React.FC<RestTimerProps> = ({
  initialSeconds = 90,
  isOpen,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSecondsLeft(initialSeconds);
      setTotalSeconds(initialSeconds);
      setIsRunning(true);
    }
  }, [isOpen, initialSeconds]);

  // Web Audio API 提示音
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (e) {
      console.log('Audio notification error:', e);
    }
  };

  useEffect(() => {
    let timer: number | undefined;
    if (isOpen && isRunning && secondsLeft > 0) {
      timer = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, isRunning, secondsLeft]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 100;

  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-6 mx-auto z-50 max-w-md px-4 pointer-events-none">
      <div className="bg-white/95 border border-slate-200/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl shadow-slate-300/70 pointer-events-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${secondsLeft === 0 ? 'bg-red-400' : 'bg-blue-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${secondsLeft === 0 ? 'bg-red-500' : 'bg-blue-600'}`}></span>
            </span>
            <span className="text-xs font-bold text-slate-700 tracking-wider">
              {secondsLeft === 0 ? '休息结束！开始下一组' : '组间休息倒计时'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSecondsLeft((s) => s + 30);
                setTotalSeconds((t) => t + 30);
              }}
              className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-blue-600 font-semibold rounded-lg flex items-center gap-0.5 border border-slate-200"
            >
              <Plus className="w-3 h-3" /> 30秒
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-300 ${secondsLeft === 0 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 倒计时与控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-black tracking-tight font-mono ${secondsLeft === 0 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
              {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
            {secondsLeft === 0 && (
              <span className="text-xs text-red-500 font-medium ml-1 flex items-center gap-1">
                <Bell className="w-3 h-3" /> 已完成休息
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {secondsLeft > 0 && (
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200"
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-600" />}
              </button>
            )}
            <button
              onClick={() => {
                setSecondsLeft(0);
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/20"
            >
              跳过休息
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
