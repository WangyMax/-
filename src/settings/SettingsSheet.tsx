import { useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { Sheet } from '../ui/Sheet';
import { SwitchTrack } from '../ui/Toggle';
import { cx } from '../ui/cx';
import { useAppSettings } from './AppSettingsContext';
import type { AppSettingKey } from './appSettings';

interface SettingRowProps {
  label: string;
  description: string;
  settingKey: AppSettingKey;
  checked: boolean;
  disabled?: boolean;
  onChange: (key: AppSettingKey, value: boolean) => void;
}

function SettingRow({ label, description, settingKey, checked, disabled, onChange }: SettingRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(settingKey, !checked)}
      className={cx(
        'flex min-h-14 w-full items-start justify-between gap-3 border-t border-line px-1 py-3 text-left first:border-t-0',
        disabled && 'opacity-50',
      )}
    >
      <span className="min-w-0">
        <span className="block text-body font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-cap leading-relaxed text-ink-3">{description}</span>
      </span>
      <SwitchTrack checked={checked} className="mt-0.5" />
    </button>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-cap font-semibold tracking-[0.04em] text-ink-3">{title}</h3>
      <div className="rounded-card border border-line bg-surface px-3">
        {children}
      </div>
    </section>
  );
}

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { settings, updateSetting, resetSettings } = useAppSettings();
  const [confirmReset, setConfirmReset] = useState(false);

  const onRowChange = (key: AppSettingKey, value: boolean) => {
    updateSetting(key, value);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="设置"
        description="只控制入口显示，不会修改或删除已有记录。"
      >
        <div className="space-y-5">
          <SettingGroup title="记录方式">
            <SettingRow
              label="超级组"
              description="递减超级组与阶梯编排；关闭后已有超级组记录照常显示"
              settingKey="showDropSets"
              checked={settings.showDropSets}
              onChange={onRowChange}
            />
            <SettingRow
              label="左右组"
              description="左右分开记录；关闭后已有单侧记录照常显示"
              settingKey="showUnilateral"
              checked={settings.showUnilateral}
              onChange={onRowChange}
            />
            <SettingRow
              label="有氧记录"
              description="计划、训练与历史里的有氧录入入口；已有有氧记录照常显示"
              settingKey="showCardio"
              checked={settings.showCardio}
              onChange={onRowChange}
            />
            <SettingRow
              label="备注入口"
              description="训练、动作与计划备注的录入入口；已有备注以只读方式显示"
              settingKey="showNotes"
              checked={settings.showNotes}
              onChange={onRowChange}
            />
          </SettingGroup>

          <SettingGroup title="今日页">
            <SettingRow
              label="未练自动休息"
              description="没训练的日子自动记为休息，不需要再打卡今日休息"
              settingKey="autoRest"
              checked={settings.autoRest}
              onChange={onRowChange}
            />
            <SettingRow
              label="补签休息"
              description={
                settings.autoRest
                  ? '自动休息已开启，无需补签；关闭自动休息后此开关生效'
                  : '今日状态卡里的补签入口，用于补齐过去的空白日'
              }
              settingKey="showBackfill"
              checked={settings.showBackfill}
              disabled={settings.autoRest}
              onChange={onRowChange}
            />
            <SettingRow
              label="自由训练"
              description="今日页的「自由训练（不选预设计划）」按钮"
              settingKey="showFreeWorkout"
              checked={settings.showFreeWorkout}
              onChange={onRowChange}
            />
          </SettingGroup>

          <p className="rounded-ctl bg-surface-subtle px-3 py-2.5 text-cap leading-relaxed text-ink-3">
            开关只隐藏新建和切换入口；已经记录的数据、容量与历史统计不会改变。
          </p>

          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-ctl text-sm2 font-semibold text-ink-3 underline hover:text-danger"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> 恢复默认设置
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmReset}
        title="恢复默认设置"
        description="所有开关都会回到开启状态，已有训练记录不受影响。"
        confirmText="恢复默认"
        danger={false}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetSettings();
          setConfirmReset(false);
        }}
      />
    </>
  );
}
