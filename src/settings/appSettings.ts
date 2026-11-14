// 全局界面设置：只控制入口显隐，不参与训练数据计算。
// 默认全部开启，保持与旧版本完全一致的界面。

export interface AppSettings {
  /** 未训练的日子自动记为休息，无需手动打卡 */
  autoRest: boolean;
  /** 显示递减超级组入口 */
  showDropSets: boolean;
  /** 显示左右分开（单侧）入口 */
  showUnilateral: boolean;
  /** 显示有氧模块入口 */
  showCardio: boolean;
  /** 显示备注录入入口 */
  showNotes: boolean;
  /** 显示今日状态卡里的补签段（自动休息开启时自动隐藏） */
  showBackfill: boolean;
  /** 显示今日页的自由训练按钮 */
  showFreeWorkout: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autoRest: true,
  showDropSets: true,
  showUnilateral: true,
  showCardio: true,
  showNotes: true,
  showBackfill: true,
  showFreeWorkout: true,
};

export type AppSettingKey = keyof AppSettings;

const STORAGE_KEY = 'fitcustom_app_settings_v1';

let cache: AppSettings | null = null;

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalize(raw: unknown): AppSettings {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<AppSettingKey, unknown>>;
  return {
    autoRest: booleanOr(parsed.autoRest, DEFAULT_APP_SETTINGS.autoRest),
    showDropSets: booleanOr(parsed.showDropSets, DEFAULT_APP_SETTINGS.showDropSets),
    showUnilateral: booleanOr(parsed.showUnilateral, DEFAULT_APP_SETTINGS.showUnilateral),
    showCardio: booleanOr(parsed.showCardio, DEFAULT_APP_SETTINGS.showCardio),
    showNotes: booleanOr(parsed.showNotes, DEFAULT_APP_SETTINGS.showNotes),
    showBackfill: booleanOr(parsed.showBackfill, DEFAULT_APP_SETTINGS.showBackfill),
    showFreeWorkout: booleanOr(parsed.showFreeWorkout, DEFAULT_APP_SETTINGS.showFreeWorkout),
  };
}

export function loadAppSettings(): AppSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_APP_SETTINGS };
  } catch {
    cache = { ...DEFAULT_APP_SETTINGS };
  }
  return cache;
}

export function saveAppSettings(next: AppSettings): void {
  cache = { ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 本地存储不可用时只在内存生效，不影响当前会话
  }
}

export function resetAppSettings(): AppSettings {
  cache = { ...DEFAULT_APP_SETTINGS };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return { ...cache };
}
