import { MedicationConfig, MedicationDose } from '../types';
import { diffLocalDays, formatLocalDate, shiftLocalDate, todayLocalDate, weekdayOf } from './date';

/**
 * 用药管理纯逻辑（无副作用、不碰 localStorage / 不被 React 依赖）。
 *
 * 周期模型：以 config.startDate 为锚点、每隔 intervalDays 天产生一个「槽位日」，
 * 每个槽位在 reminderTime 这个本地时刻应服一次。槽位与实际打卡时间解耦：
 *  - 准时打卡：slotDate = 当天槽位，takenAt = 打卡时刻；
 *  - 逾期补记：slotDate 仍是原槽位，takenAt 落在别的日期 → 展示为「逾期补记」；
 *  - 隔天节律不会因为一次迟到而被推后，避免越拖越乱。
 */

/** 备份导入等外部写入后广播，让用药状态重新从 localStorage 读取 */
export const MED_CHANGED_EVENT = 'fitcustom:medication-changed';

export const DEFAULT_MED_INTERVAL_HOURS = 48;
/** 默认提醒时间：中午 12:00（v2.9.1 起，原为 21:00） */
export const DEFAULT_MED_REMINDER_TIME = '12:00';
const FALLBACK_MINUTES = 12 * 60;
/** 历史与统计的默认回看窗口（天） */
export const MED_HISTORY_DAYS = 90;
const MAX_SLOT_ITERATIONS = 600;

export const MED_INTERVAL_OPTIONS = [
  { value: '24', label: '每天' },
  { value: '48', label: '隔天 (48h)' },
  { value: '72', label: '每 3 天' },
] as const;

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

export function createDefaultMedicationConfig(startDate: string = todayLocalDate()): MedicationConfig {
  return {
    name: '非那雄胺',
    dosage: '1 mg',
    intervalHours: DEFAULT_MED_INTERVAL_HOURS,
    reminderTime: DEFAULT_MED_REMINDER_TIME,
    reminderEnabled: true,
    startDate,
    notes: '',
  };
}

/** 把任意来源（旧数据 / 备份 / 用户输入）的配置收敛成合法配置 */
export function normalizeMedicationConfig(input?: Partial<MedicationConfig> | null): MedicationConfig {
  const base = createDefaultMedicationConfig();
  if (!input || typeof input !== 'object') return base;

  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : base.name;
  const dosage = typeof input.dosage === 'string' ? input.dosage.trim() : base.dosage;
  const reminderTime = normalizeTimeString(input.reminderTime) ?? base.reminderTime;
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate ?? ''))
    ? String(input.startDate)
    : base.startDate;

  return {
    name,
    dosage,
    intervalHours: clampIntervalHours(Number(input.intervalHours)),
    reminderTime,
    reminderEnabled: input.reminderEnabled !== false,
    startDate,
    notes: typeof input.notes === 'string' ? input.notes : '',
  };
}

function clampIntervalHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_MED_INTERVAL_HOURS;
  const days = Math.min(30, Math.max(1, Math.round(hours / 24)));
  return days * 24;
}

/** 周期天数：24h→1 天、48h→2 天（隔天）、72h→3 天 */
export function intervalDaysOf(config: MedicationConfig): number {
  return Math.max(1, Math.round(clampIntervalHours(config.intervalHours) / 24));
}

export function intervalLabel(config: MedicationConfig): string {
  const days = intervalDaysOf(config);
  return days === 1 ? '每天一次' : `每 ${days} 天一次`;
}

/** 'HH:mm' → 0..1439 分钟；非法值回落 21:00 */
export function parseTimeToMinutes(value: string | undefined | null): number {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return FALLBACK_MINUTES;
  const hour = Math.min(23, Math.max(0, Number(matched[1])));
  const minute = Math.min(59, Math.max(0, Number(matched[2])));
  return hour * 60 + minute;
}

export function minutesToTime(total: number): string {
  const safe = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function normalizeTimeString(value: string | undefined | null): string | null {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!matched) return null;
  return minutesToTime(parseTimeToMinutes(`${matched[1]}:${matched[2]}`));
}

/** 某日期槽位的应服时间戳（本地时区） */
export function slotTimestamp(dateStr: string, reminderTime: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const minutes = parseTimeToMinutes(reminderTime);
  return new Date(year, (month || 1) - 1, day || 1, Math.floor(minutes / 60), minutes % 60, 0, 0).getTime();
}

/** 不晚于 dateStr 的最近槽位日；锚点在未来时返回 null */
export function lastSlotOnOrBefore(config: MedicationConfig, dateStr: string): string | null {
  const step = intervalDaysOf(config);
  const diff = diffLocalDays(config.startDate, dateStr);
  if (diff < 0) return null;
  const index = Math.floor(diff / step);
  return shiftLocalDate(config.startDate, index * step);
}

/** 不早于 dateStr 的最近槽位日；锚点在未来时返回锚点日本身 */
export function nextSlotOnOrAfter(config: MedicationConfig, dateStr: string): string {
  const step = intervalDaysOf(config);
  const diff = diffLocalDays(config.startDate, dateStr);
  if (diff <= 0) return config.startDate;
  const index = Math.ceil(diff / step);
  return shiftLocalDate(config.startDate, index * step);
}

export type MedicationSlotStatus = 'taken' | 'skipped' | 'pending' | 'missed' | 'upcoming';

export interface MedicationSlot {
  date: string;
  dueAt: number;
  dose: MedicationDose | null;
  status: MedicationSlotStatus;
  /** 打卡日期与槽位日不一致（逾期补记） */
  late: boolean;
}

export interface MedicationStats {
  taken: number;
  missed: number;
  skipped: number;
  total: number;
  /** 依从率（只算已服用 / 应服用，跳过不计入分母），无数据时返回 0 */
  rate: number;
}

export interface MedicationState {
  today: string;
  stepDays: number;
  /** 今天是否为应服日（未打卡时 status 为 pending/upcoming） */
  todaySlot: MedicationSlot | null;
  /** 当前待处理的应服槽位：<= 今天且尚未打卡的最近一个 */
  dueSlot: MedicationSlot | null;
  /** 未来槽位（升序，最多 4 个） */
  upcoming: MedicationSlot[];
  /** 下次应服时间戳（待处理槽位优先） */
  nextDueAt: number | null;
  /** 已逾期毫秒（未逾期为 0） */
  overdueMs: number;
  /** 到点提醒条件：有待处理槽位且已过应服时刻 */
  isDue: boolean;
  takenToday: MedicationDose | null;
  lastTaken: MedicationDose | null;
  /** 连续按时完成次数（跳过与漏服都会中断） */
  streak: number;
  stats: MedicationStats;
  /** 历史槽位（新→旧，含今天；窗口 MED_HISTORY_DAYS） */
  history: MedicationSlot[];
  /** 最近 7 个槽位（旧→新），用于顶部链式状态条 */
  chain: MedicationSlot[];
}

function makeSlot(
  config: MedicationConfig,
  date: string,
  dose: MedicationDose | null,
  dueDate: string | null,
  today: string,
  nowMs: number,
): MedicationSlot {
  const dueAt = slotTimestamp(date, config.reminderTime);
  const late = dose?.status === 'taken' ? formatLocalDate(new Date(dose.takenAt)) !== date : false;

  let status: MedicationSlotStatus;
  if (dose?.status === 'taken') status = 'taken';
  else if (dose?.status === 'skipped') status = 'skipped';
  else if (date === dueDate) status = nowMs >= dueAt ? 'pending' : 'upcoming';
  else if (date < today) status = 'missed';
  else status = nowMs >= dueAt ? 'pending' : 'upcoming';

  return { date, dueAt, dose, status, late };
}

export function getMedicationState(
  configInput: MedicationConfig,
  doses: MedicationDose[],
  now: Date = new Date(),
): MedicationState {
  const config = normalizeMedicationConfig(configInput);
  const nowMs = now.getTime();
  const today = formatLocalDate(now);
  const step = intervalDaysOf(config);

  const doseByDate = new Map<string, MedicationDose>();
  for (const dose of doses) {
    if (dose && typeof dose.slotDate === 'string') doseByDate.set(dose.slotDate, dose);
  }

  // 当前待处理槽位：只认「最近一个槽位」。
  // 它已打卡 → 本轮完成，首页显示下一次；它没打卡 → 待补记/已逾期。
  // 更早的空缺一律按「漏服」沉到历史里（历史行可逐条补记），
  // 否则一次遗忘会让首页永远卡在很久以前的“待补”，反而遮住今天的操作。
  const latestSlotDate = lastSlotOnOrBefore(config, today);
  const dueDate: string | null =
    latestSlotDate && !doseByDate.has(latestSlotDate) ? latestSlotDate : null;

  const historyStart = shiftLocalDate(today, -MED_HISTORY_DAYS);
  const windowStart = dueDate && dueDate < historyStart ? dueDate : historyStart;
  const windowEnd = shiftLocalDate(today, step * 3);

  const slots: MedicationSlot[] = [];
  let dateCursor = nextSlotOnOrAfter(config, windowStart);
  for (let i = 0; i < MAX_SLOT_ITERATIONS && dateCursor <= windowEnd; i++) {
    slots.push(makeSlot(config, dateCursor, doseByDate.get(dateCursor) ?? null, dueDate, today, nowMs));
    dateCursor = shiftLocalDate(dateCursor, step);
  }

  const pastSlots = slots.filter(slot => slot.date <= today);
  const history = [...pastSlots].reverse();
  const upcoming = slots.filter(slot => slot.date > today).slice(0, 4);
  const dueSlot = dueDate ? pastSlots.find(slot => slot.date === dueDate) ?? null : null;
  const todaySlot = pastSlots.find(slot => slot.date === today) ?? null;

  const taken = pastSlots.filter(slot => slot.status === 'taken').length;
  const missed = pastSlots.filter(slot => slot.status === 'missed').length;
  const skipped = pastSlots.filter(slot => slot.status === 'skipped').length;
  const denominator = taken + missed;
  const stats: MedicationStats = {
    taken,
    missed,
    skipped,
    total: taken + missed + skipped,
    rate: denominator > 0 ? Math.round((taken / denominator) * 100) : 0,
  };

  let streak = 0;
  for (let i = pastSlots.length - 1; i >= 0; i--) {
    const slot = pastSlots[i];
    if (slot.status === 'pending' || slot.status === 'upcoming') continue;
    if (slot.status === 'taken') streak++;
    else break;
  }

  let lastTaken: MedicationDose | null = null;
  for (const dose of doses) {
    if (dose?.status !== 'taken') continue;
    if (!lastTaken || dose.takenAt > lastTaken.takenAt) lastTaken = dose;
  }

  const takenToday = todaySlot?.dose?.status === 'taken' ? todaySlot.dose : null;
  const nextDueAt = dueSlot ? dueSlot.dueAt : upcoming[0]?.dueAt ?? null;
  const isDue = Boolean(dueSlot && nowMs >= dueSlot.dueAt);
  const overdueMs = dueSlot && nowMs > dueSlot.dueAt ? nowMs - dueSlot.dueAt : 0;

  return {
    today,
    stepDays: step,
    todaySlot,
    dueSlot,
    upcoming,
    nextDueAt,
    overdueMs,
    isDue,
    takenToday,
    lastTaken,
    streak,
    stats,
    history,
    chain: pastSlots.slice(-7),
  };
}

/** 把「最近一次未打卡的应服槽位」标记为已服用（默认取当前待处理槽位） */
export function buildDoseRecord(slotDate: string, status: MedicationDose['status'] = 'taken'): MedicationDose {
  return {
    id: `med-${slotDate}-${Date.now()}`,
    slotDate,
    takenAt: Date.now(),
    status,
  };
}

export function formatSlotLabel(dateStr: string): string {
  return `${dateStr.slice(5)} 周${WEEKDAY_SHORT[weekdayOf(dateStr)]}`;
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 倒计时文案：1 天 3 小时 / 3 小时 20 分 / 12 分钟 / 已到时间 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '已到时间';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  if (minutes > 0) return `${minutes} 分钟`;
  return '不到 1 分钟';
}

/** 逾期文案：逾期 1 天 3 小时 */
export function formatOverdue(ms: number): string {
  if (ms <= 0) return '未逾期';
  return `已逾期 ${formatCountdown(ms)}`;
}

export const SLOT_STATUS_LABELS: Record<MedicationSlotStatus, string> = {
  taken: '已服用',
  skipped: '已跳过',
  pending: '待服用',
  missed: '漏服',
  upcoming: '待服用',
};
