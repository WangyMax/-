import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * 自研原生插件「MedicationNative」的 JS 封装（Java 侧见
 * android/app/src/main/java/com/fitcustom/pro/MedicationNativePlugin.java）。
 *
 * 为什么需要它（v2.9.2 修复用户反馈的两个问题）：
 *  1. 通知权限：@capacitor/local-notifications 的 checkPermissions 只能反映
 *     「运行时权限」，无法反映「系统设置里被关掉通知」以及「运行时权限被永久拒绝」。
 *     这里用 NotificationManagerCompat.areNotificationsEnabled() 做一次真实探测；
 *  2. 通知权限被永久拒绝后系统不再弹窗，必须给用户一个「打开系统通知设置」的入口；
 *  3. .ics 文件：Share 插件只会发 ACTION_SEND，国内 ROM 的日历多数只注册 ACTION_VIEW，
 *     所以改用 ACTION_VIEW + text/calendar 直接唤起居中的日历导入界面。
 *
 * 全部调用都做「插件不存在就返回 null/false」的降级：
 * 老版本 APK（没有这个插件）+ 新 JS 也不会抛错。
 */

interface NotificationsEnabledResult {
  enabled: boolean;
  sdkInt?: number;
}

interface OpenResult {
  opened: boolean;
}

export interface MedicationNativeApi {
  notificationsEnabled(): Promise<NotificationsEnabledResult>;
  openNotificationSettings(): Promise<OpenResult>;
  openIcsFile(options: { uri: string }): Promise<OpenResult>;
}

const PLUGIN_NAME = 'MedicationNative';

let cached: MedicationNativeApi | null | undefined;

function getPlugin(): MedicationNativeApi | null {
  if (cached !== undefined) return cached;
  if (!Capacitor.isNativePlatform()) {
    cached = null;
    return cached;
  }
  try {
    cached = registerPlugin<MedicationNativeApi>(PLUGIN_NAME);
  } catch {
    cached = null;
  }
  return cached;
}

/** 系统层面本应用的通知是否被允许；拿不到返回 null（不当作"被拒绝"） */
export async function queryNotificationsEnabled(): Promise<boolean | null> {
  const plugin = getPlugin();
  if (!plugin) return null;
  try {
    const result = await plugin.notificationsEnabled();
    return typeof result?.enabled === 'boolean' ? result.enabled : null;
  } catch {
    return null;
  }
}

/** 打开系统里本应用的通知设置页；返回是否成功唤起 */
export async function openNotificationSettings(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.openNotificationSettings();
    return result?.opened === true;
  } catch {
    return false;
  }
}

/** 用系统日历打开 .ics（ACTION_VIEW + text/calendar）；返回是否成功唤起 */
export async function openIcsWithSystemCalendar(uri: string): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.openIcsFile({ uri });
    return result?.opened === true;
  } catch {
    return false;
  }
}
