// 组间休息计时服务：基于目标绝对时间戳，切后台/锁屏/息屏不丢时长，支持一加/OPPO硬件震动

const STORAGE_KEY = 'fitcustom_rest_target_time';
const STORAGE_TOTAL_KEY = 'fitcustom_rest_total_duration';

type TimerListener = (secondsLeft: number, totalSeconds: number, isFinished: boolean) => void;

class RestTimerService {
  private listeners: Set<TimerListener> = new Set();
  private intervalId: number | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    // 监听应用从后台切回前台事件，毫秒级绝对校准
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.tick();
        }
      });
      window.addEventListener('focus', () => this.tick());
      window.addEventListener('pageshow', () => this.tick());
    }
  }

  // 启动 120 秒（2分钟）组间休息倒计时
  public start(seconds: number = 120) {
    const targetEndTime = Date.now() + seconds * 1000;
    localStorage.setItem(STORAGE_KEY, targetEndTime.toString());
    localStorage.setItem(STORAGE_TOTAL_KEY, seconds.toString());

    // 唤起 OPPO/一加 系统级原生流体云灵动胶囊
    try {
      const win = window as unknown as { Capacitor?: { Plugins?: { FluidMediaCapsule?: { start: (opts: { seconds: number }) => Promise<void> } } } };
      win.Capacitor?.Plugins?.FluidMediaCapsule?.start({ seconds });
    } catch {
      // ignore
    }

    this.ensureTicker();
    this.tick();
  }

  // 增加/减少时长
  public addSeconds(delta: number) {
    const rawTarget = localStorage.getItem(STORAGE_KEY);
    if (!rawTarget) {
      if (delta > 0) this.start(delta);
      return;
    }
    const currentTarget = parseInt(rawTarget, 10);
    const newTarget = Math.max(Date.now(), currentTarget + delta * 1000);
    localStorage.setItem(STORAGE_KEY, newTarget.toString());
    
    const rawTotal = localStorage.getItem(STORAGE_TOTAL_KEY);
    const currentTotal = rawTotal ? parseInt(rawTotal, 10) : 120;
    localStorage.setItem(STORAGE_TOTAL_KEY, (currentTotal + delta).toString());

    const remaining = Math.max(1, Math.ceil((newTarget - Date.now()) / 1000));
    try {
      const win = window as unknown as { Capacitor?: { Plugins?: { FluidMediaCapsule?: { start: (opts: { seconds: number }) => Promise<void> } } } };
      win.Capacitor?.Plugins?.FluidMediaCapsule?.start({ seconds: remaining });
    } catch {
      // ignore
    }

    this.tick();
  }

  // 停止并清除计时
  public stop() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TOTAL_KEY);
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    try {
      const win = window as unknown as { Capacitor?: { Plugins?: { FluidMediaCapsule?: { stop: () => Promise<void> } } } };
      win.Capacitor?.Plugins?.FluidMediaCapsule?.stop();
    } catch {
      // ignore
    }

    this.notify(0, 0, false);
  }

  // 获取当前剩余秒数
  public getSecondsLeft(): number {
    const rawTarget = localStorage.getItem(STORAGE_KEY);
    if (!rawTarget) return 0;
    const targetTime = parseInt(rawTarget, 10);
    const diff = targetTime - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  }

  public getTotalSeconds(): number {
    const rawTotal = localStorage.getItem(STORAGE_TOTAL_KEY);
    return rawTotal ? parseInt(rawTotal, 10) : 120;
  }

  // 订阅计时变动
  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    this.tick();
    this.ensureTicker();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureTicker() {
    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => {
        this.tick();
      }, 500);
    }
  }

  private tick() {
    const rawTarget = localStorage.getItem(STORAGE_KEY);
    if (!rawTarget) {
      this.notify(0, 0, false);
      return;
    }

    const targetTime = parseInt(rawTarget, 10);
    const diff = targetTime - Date.now();
    const total = this.getTotalSeconds();

    if (diff <= 0) {
      // 倒计时到达 0：触发强烈震动与提示音
      this.notify(0, total, true);
      this.triggerAlert();
    } else {
      const secondsLeft = Math.ceil(diff / 1000);
      this.notify(secondsLeft, total, false);
    }
  }

  private notify(secondsLeft: number, totalSeconds: number, isFinished: boolean) {
    this.listeners.forEach(l => l(secondsLeft, totalSeconds, isFinished));
  }

  // 触发震动与声音提醒
  public triggerAlert() {
    // 1. 安卓线性马达震动 (ColorOS 力量训练专属节律连震)
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 150, 400, 150, 700]);
      }
    } catch (e) {
      console.warn('Vibration failed:', e);
    }

    // 2. 清脆清亮 Web Audio 提示音
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 纯净高音
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      // ignore
    }
  }
}

export const restTimer = new RestTimerService();
