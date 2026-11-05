import { useCallback, useEffect, useMemo, useState } from 'react';
import { MedicationConfig, MedicationDose } from '../types';
import { StorageService } from './storage';
import {
  buildDoseRecord, createDefaultMedicationConfig, getMedicationState, MED_CHANGED_EVENT, MedicationState,
} from './medication';
import {
  getReminderPermissionInfo,
  ReminderPermission,
  ReminderPermissionInfo,
  requestReminderPermissionInfo,
  syncMedicationReminders,
} from './medicationReminder';
import { openNotificationSettings as openSettingsPage } from './medicationNative';

/**
 * 用药管理的状态中枢：一次 hook 同时服务「用药 Tab」与「全局到点提醒弹层」，
 * 保证两处看到的是同一份数据（打卡后底部导航小红点立刻消失）。
 *
 * 数据来源仍是 StorageService（localStorage 单一事实源），hook 只持有内存快照。
 */
export interface MedicationController {
  config: MedicationConfig;
  doses: MedicationDose[];
  state: MedicationState;
  now: number;
  permission: ReminderPermission;
  /** 权限判定的完整信息（插件原始值 + 系统层面状态 + 错误），界面用于自诊断 */
  permissionInfo: ReminderPermissionInfo;
  /** 本次实际排上的系统通知条数 */
  scheduled: number;
  /** 排期失败原因（例如系统里关掉了本应用通知） */
  syncError?: string;
  /** 开关打开且系统通知已授权，才算「真的会响」 */
  reminderActive: boolean;
  snoozeUntil: number;
  updateConfig: (patch: Partial<MedicationConfig>) => void;
  markTaken: (slotDate?: string) => void;
  skipSlot: (slotDate?: string) => void;
  removeDose: (id: string) => void;
  requestPermission: () => Promise<ReminderPermissionInfo>;
  /** 只回读状态、不弹系统对话框（从系统设置页返回时用） */
  recheckPermission: () => Promise<ReminderPermissionInfo>;
  /** 跳系统通知设置页：运行时权限被永久拒绝后，系统不会再弹窗，只能走这条路 */
  openNotificationSettings: () => Promise<boolean>;
  snooze: (durationMs: number) => void;
  refresh: () => void;
}

const TICK_MS = 30_000;

export function useMedication(): MedicationController {
  // 首帧用纯函数默认值（不读 localStorage），真实数据在挂载后的 effect 里读盘，
  // 遵守「渲染路径零 IO」的既有约定（见手册二·7）
  const [config, setConfig] = useState<MedicationConfig>(() => createDefaultMedicationConfig());
  const [doses, setDoses] = useState<MedicationDose[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [permissionInfo, setPermissionInfo] = useState<ReminderPermissionInfo>(() => ({
    permission: 'prompt',
    pluginPermission: 'prompt',
    nativeEnabled: null,
  }));
  const [scheduled, setScheduled] = useState(0);
  const [syncError, setSyncError] = useState<string | undefined>(undefined);
  const [snoozeUntil, setSnoozeUntil] = useState<number>(0);
  // 回到前台时 +1，触发一次通知重排（WebView 后台会暂停定时器，不能只靠 interval）
  const [resyncToken, setResyncToken] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      tick();
      setResyncToken(value => value + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const state = useMemo(
    () => getMedicationState(config, doses, new Date(now)),
    [config, doses, now],
  );

  useEffect(() => {
    let alive = true;
    void getReminderPermissionInfo().then(result => {
      if (alive) setPermissionInfo(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 配置 / 记录 / 前台回归 → 重排系统通知（幂等：先撤后排）
  useEffect(() => {
    let alive = true;
    void syncMedicationReminders(config, doses).then(result => {
      if (!alive) return;
      setScheduled(result.scheduled);
      setSyncError(result.error);
      if (result.permission !== 'unsupported') {
        setPermissionInfo({
          permission: result.permission,
          pluginPermission: result.pluginPermission,
          nativeEnabled: result.nativeEnabled,
          error: result.error,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [config, doses, resyncToken]);

  const updateConfig = useCallback((patch: Partial<MedicationConfig>) => {
    setConfig(prev => StorageService.saveMedicationConfig({ ...prev, ...patch }));
  }, []);

  const markTaken = useCallback(
    (slotDate?: string) => {
      const target = slotDate ?? state.dueSlot?.date ?? state.today;
      setDoses([...StorageService.upsertMedicationDose(buildDoseRecord(target, 'taken'))]);
      StorageService.setMedicationSnooze(0);
      setSnoozeUntil(0);
      setNow(Date.now());
    },
    [state.dueSlot?.date, state.today],
  );

  const skipSlot = useCallback(
    (slotDate?: string) => {
      const target = slotDate ?? state.dueSlot?.date ?? state.today;
      setDoses([...StorageService.upsertMedicationDose(buildDoseRecord(target, 'skipped'))]);
      StorageService.setMedicationSnooze(0);
      setSnoozeUntil(0);
      setNow(Date.now());
    },
    [state.dueSlot?.date, state.today],
  );

  const removeDose = useCallback((id: string) => {
    setDoses([...StorageService.deleteMedicationDose(id)]);
    setNow(Date.now());
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestReminderPermissionInfo();
    setPermissionInfo(result);
    setResyncToken(value => value + 1);
    return result;
  }, []);

  const recheckPermission = useCallback(async () => {
    const result = await getReminderPermissionInfo();
    setPermissionInfo(result);
    setResyncToken(value => value + 1);
    return result;
  }, []);

  const openNotificationSettings = useCallback(async () => {
    const opened = await openSettingsPage();
    // 从系统设置页切回 App 时 visibilitychange 会再回读一次，这里不阻塞等待
    return opened;
  }, []);

  const snooze = useCallback((durationMs: number) => {
    const until = Date.now() + durationMs;
    StorageService.setMedicationSnooze(until);
    setSnoozeUntil(until);
  }, []);

  const refresh = useCallback(() => {
    // 外部写入（备份导入 / 恢复官方数据）后重新读盘
    setConfig(StorageService.getMedicationConfig());
    setDoses([...StorageService.getMedicationDoses()]);
    setSnoozeUntil(StorageService.getMedicationSnooze());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener(MED_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MED_CHANGED_EVENT, handler);
  }, [refresh]);

  // 挂载后立刻读盘一次（首帧渲染没有 IO）
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    config,
    doses,
    state,
    now,
    permission: permissionInfo.permission,
    permissionInfo,
    scheduled,
    syncError,
    reminderActive: config.reminderEnabled && permissionInfo.permission === 'granted',
    snoozeUntil,
    updateConfig,
    markTaken,
    skipSlot,
    removeDose,
    requestPermission,
    recheckPermission,
    openNotificationSettings,
    snooze,
    refresh,
  };
}
