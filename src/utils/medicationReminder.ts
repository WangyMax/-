import { Capacitor } from '@capacitor/core';
import type { MedicationConfig, MedicationDose } from '../types';
import { diffLocalDays, shiftLocalDate } from './date';
import { getMedicationState, intervalLabel, nextSlotOnOrAfter, slotTimestamp } from './medication';
import { queryNotificationsEnabled } from './medicationNative';

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
 *
 * v2.9.2 修复（用户反馈「开关已开但仍提示没有通知权限，点按钮没反应」）：
 *  - 权限判定改为「插件运行时权限 + 系统层面 areNotificationsEnabled」两路交叉验证，
 *    并把两者原始值通过 ReminderPermissionInfo 暴露给界面，便于诊断；
 *  - requestPermissions 加超时保护：某些 ROM 上系统对话框被吞掉时 Promise 永不 resolve，
 *    界面就会"点了没反应"，超时后回落到当前真实状态；
 *  - 排期结果（条数 / 错误）一并回传，界面可以显示「已排期 N 条」。
 */

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface ReminderPermissionInfo {
  /** 综合结论：界面按这个显示 */
  permission: ReminderPermission;
  /** 插件原始运行时权限（诊断用） */
  pluginPermission: ReminderPermission;
  /** 系统层面通知是否允许；null 表示探测不到（Web / 老 APK） */
  nativeEnabled: boolean | null;
  /** 插件调用失败的原始信息（诊断用） */
  error?: string;
}

const NOTIFICATION_ID_BASE = 71_000_000;
const NOTIFICATION_ID_SPAN = 100_000;
const ID_DATE_EPOCH = '2024-01-01';
/** 一次排期覆盖的槽位数：隔天用药约 32 天，足够撑到下次冷启动 */
const MAX_SCHEDULED = 16;
/** 距离触发不足 30 秒的槽位不再排（系统会立即弹出，反而打扰） */
const MIN_LEAD_MS = 30_000;
/** 系统权限对话框的超时保护：超过这个时间没回音就放弃并回读真实状态 */
const PERMISSION_TIMEOUT_MS = 6_000;

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

/**
 * 交叉判定：
 *  - prompt 保持 prompt（"还没问过"，必须弹系统对话框）；
 *  - granted 但系统层面被关掉（通道/应用级屏蔽）→ denied；
 *  - denied 保持 denied（此时系统不会再弹窗，只能去设置里手动开）。
 */
function decide(pluginPermission: ReminderPermission, nativeEnabled: boolean | null): ReminderPermission {
  if (pluginPermission === 'unsupported' || pluginPermission === 'prompt') return pluginPermission;
  if (nativeEnabled === false) return 'denied';
  return pluginPermission;
}

/** 槽位日期 → 通知 id（同一天同一槽位恒定，重排即覆盖） */
export function notificationIdForSlot(dateStr: string): number {
  const offset = diffLocalDays(ID_DATE_EPOCH, dateStr);
  return NOTIFICATION_ID_BASE + Math.max(0, Math.min(NOTIFICATION_ID_SPAN - 1, offset));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    promise
      .then(value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/** 读当前权限状态（不发弹窗） */
export async function getReminderPermissionInfo(): Promise<ReminderPermissionInfo> {
  const api = await loadApi();
  if (!api) {
    return { permission: 'unsupported', pluginPermission: 'unsupported', nativeEnabled: null };
  }
  const nativeEnabled = await queryNotificationsEnabled();
  try {
    const status = await api.checkPermissions();
    const pluginPermission = toPermission(status.display);
    return { permission: decide(pluginPermission, nativeEnabled), pluginPermission, nativeEnabled };
  } catch (err) {
    return {
      permission: 'unsupported',
      pluginPermission: 'unsupported',
      nativeEnabled,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  return (await getReminderPermissionInfo()).permission;
}

/** 发起系统权限申请（会弹对话框），带超时保护 */
export async function requestReminderPermissionInfo(): Promise<ReminderPermissionInfo> {
  const api = await loadApi();
  if (!api) {
    return { permission: 'unsupported', pluginPermission: 'unsupported', nativeEnabled: null };
  }
  const nativeBefore = await queryNotificationsEnabled();
  try {
    const status = await withTimeout(api.requestPermissions(), PERMISSION_TIMEOUT_MS);
    const nativeEnabled = await queryNotificationsEnabled();
    if (!status) {
      // 系统对话框没回音（部分 ROM 会吞掉回调）：回读真实状态，界面不至于"卡在提示上"
      const fallback = await getReminderPermissionInfo();
      return { ...fallback, error: 'request_timeout' };
    }
    const pluginPermission = toPermission(status.display);
    return {
      permission: decide(pluginPermission, nativeEnabled ?? nativeBefore),
      pluginPermission,
      nativeEnabled: nativeEnabled ?? nativeBefore,
    };
  } catch (err) {
    const nativeEnabled = await queryNotificationsEnabled();
    return {
      permission: decide('denied', nativeEnabled),
      pluginPermission: 'denied',
      nativeEnabled,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  return (await requestReminderPermissionInfo()).permission;
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
  pluginPermission: ReminderPermission;
  nativeEnabled: boolean | null;
  error?: string;
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
  if (!api) {
    return {
      scheduled: 0,
      permission: 'unsupported',
      ok: false,
      pluginPermission: 'unsupported',
      nativeEnabled: null,
    };
  }

  await cancelMedicationReminders();
  const info = await getReminderPermissionInfo();
  const base = {
    scheduled: 0,
    permission: info.permission,
    pluginPermission: info.pluginPermission,
    nativeEnabled: info.nativeEnabled,
    error: info.error,
  };

  if (info.permission !== 'granted') {
    return { ...base, ok: true };
  }
  if (!config.reminderEnabled) {
    return { ...base, ok: true };
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
      return { ...base, ok: true };
    }

    await api.schedule({ notifications });
    return { ...base, scheduled: notifications.length, ok: true };
  } catch (err) {
    // 常见：用户在系统里关掉了本应用通知（NOTIFICATIONS_DISABLED）
    console.warn('[用药提醒] 排期失败：', err);
    return {
      ...base,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
