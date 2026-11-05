import { Capacitor } from '@capacitor/core';
import type { MedicationConfig, MedicationDose } from '../types';
import { diffLocalDays, shiftLocalDate } from './date';
import { getMedicationState, intervalLabel, nextSlotOnOrAfter, slotTimestamp } from './medication';

/**
 * 系统通知排期（48h 隔天服药提醒）。
 *
 * 平台事实：Capacitor WebView 在 App 进程被杀后没有 JS 运行环境，
 * 只靠 setInterval / Web Notification 不可能在后台准时响铃，必须落到
 * Android AlarmManager（@capacitor/local-notifications）。
 *
 * 策略：
 *  - 不用 `every: 'day'` 之类的固定轮询（不支持 48h 间隔），改为把未来若干个
 *    槽位一次性排成 N 条「单次通知」，每次打开 App / 改设置 / 打卡都重排一遍；
 *  - 排期 id 由槽位日期推导（NOTIFICATION_ID_BASE + 距 2024-01-01 的天数），
 *    天然稳定且唯一，重排不会产生重复通知；
 *  - isExactNotification=false + allowWhileIdle=true：不触发 Android 12+
 *    「闹钟与提醒」授权弹窗（该授权对普通提醒过重），Doze 下仍可唤醒，
 *    最坏延迟数分钟，对用药提醒完全够用；
 *  - 全部调用都 try/catch：权限被拒、系统关通知、插件缺失时只降级，不崩溃。
 */

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const NOTIFICATION_ID_BASE = 71_000_000;
const NOTIFICATION_ID_SPAN = 100_000;
const ID_DATE_EPOCH = '2024-01-01';
/** 一次排期覆盖的槽位数：隔天用药约 32 天，足够撑到下次冷启动 */
const MAX_SCHEDULED = 16;
/** 距离触发不足 30 秒的槽位不再排（系统会立即弹出，反而打扰） */
const MIN_LEAD_MS = 30_000;

type NotificationsApi = (typeof import('@capacitor/local-notifications'))['LocalNotifications'];

let apiPromise: Promise<NotificationsApi | null> | null = null;

function loadApi(): Promise<NotificationsApi | null> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  if (!apiPromise) {
    apiPromise = import('@capacitor/local-notifications')
      .then(mod => mod.LocalNotifications)
      .catch((err: unknown) => {
        console.warn('[用药提醒] 本地通知插件不可用：', err);
        return null;
      });
  }
  return apiPromise;
}

function toPermission(display: string | undefined): ReminderPermission {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'prompt';
}

/** 槽位日期 → 通知 id（同一天同一槽位恒定，重排即覆盖） */
export function notificationIdForSlot(dateStr: string): number {
  const offset = diffLocalDays(ID_DATE_EPOCH, dateStr);
  return NOTIFICATION_ID_BASE + Math.max(0, Math.min(NOTIFICATION_ID_SPAN - 1, offset));
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  const api = await loadApi();
  if (!api) return 'unsupported';
  try {
    const status = await api.checkPermissions();
    return toPermission(status.display);
  } catch {
    return 'unsupported';
  }
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  const api = await loadApi();
  if (!api) return 'unsupported';
  try {
    const status = await api.requestPermissions();
    return toPermission(status.display);
  } catch {
    return 'unsupported';
  }
}

/** 只撤销本功能自己排的通知：id 落在专用区间内 */
export async function cancelMedicationReminders(): Promise<void> {
  const api = await loadApi();
  if (!api) return;
  try {
    const pending = await api.getPending();
    const targets = pending.notifications
      .filter(item => item.id >= NOTIFICATION_ID_BASE && item.id < NOTIFICATION_ID_BASE + NOTIFICATION_ID_SPAN)
      .map(item => ({ id: item.id }));
    if (targets.length > 0) {
      await api.cancel({ notifications: targets });
    }
  } catch (err) {
    console.warn('[用药提醒] 取消排期失败：', err);
  }
}

export interface ReminderSyncResult {
  /** 实际排上的通知条数（0 表示没有排期：未授权 / 已关闭 / 非原生平台） */
  scheduled: number;
  permission: ReminderPermission;
  /** 是否处于「可以提醒」的状态（已关闭提醒也会返回 true，只是不排期） */
  ok: boolean;
}

/**
 * 重排全部用药提醒。调用点：启动、配置变更、打卡 / 撤销、从后台回到前台。
 * 幂等：先撤销旧排期再按当前配置生成新排期。
 */
export async function syncMedicationReminders(
  config: MedicationConfig,
  doses: MedicationDose[],
): Promise<ReminderSyncResult> {
  const api = await loadApi();
  if (!api) return { scheduled: 0, permission: 'unsupported', ok: false };

  await cancelMedicationReminders();
  const permission = await getReminderPermission();
  if (permission !== 'granted') {
    return { scheduled: 0, permission, ok: true };
  }
  if (!config.reminderEnabled) {
    return { scheduled: 0, permission, ok: true };
  }

  try {
    const now = Date.now();
    const state = getMedicationState(config, doses, new Date(now));
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
      isExactNotification: boolean;
      autoCancel: boolean;
      extra: { medicationSlot: string };
    }> = [];

    let cursor = nextSlotOnOrAfter(config, state.today);
    for (let i = 0; i < MAX_SCHEDULED * 2 && notifications.length < MAX_SCHEDULED; i++) {
      const at = slotTimestamp(cursor, config.reminderTime);
      if (at > now + MIN_LEAD_MS) {
        const slotDate = cursor;
        notifications.push({
          id: notificationIdForSlot(slotDate),
          title: `该服用${config.name}了`,
          body: `${config.dosage ? `${config.dosage} · ` : ''}${intervalLabel(config)} · ${config.reminderTime} 提醒，服用后进 App 打卡`,
          schedule: { at: new Date(at), allowWhileIdle: true },
          isExactNotification: false,
          autoCancel: true,
          extra: { medicationSlot: slotDate },
        });
      }
      cursor = shiftLocalDate(cursor, state.stepDays);
    }

    if (notifications.length === 0) {
      return { scheduled: 0, permission, ok: true };
    }

    await api.schedule({ notifications });
    return { scheduled: notifications.length, permission, ok: true };
  } catch (err) {
    // 常见：用户在系统里关掉了本应用通知（NOTIFICATIONS_DISABLED）
    console.warn('[用药提醒] 排期失败：', err);
    return { scheduled: 0, permission, ok: false };
  }
}
