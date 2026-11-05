import { useMemo, useState } from 'react';
import {
  BellOff, BellRing, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronUp, Clock, Info, Pill,
  ShieldAlert, SkipForward, Trash2,
} from 'lucide-react';
import { Badge, Button, Card, cx, IconButton, NumberText, SegmentedControl, Sheet } from '../ui';
import { ConfirmSheet } from './ConfirmSheet';
import { MedicationController } from '../utils/useMedication';
import {
  formatClock, formatCountdown, formatOverdue, formatSlotLabel, intervalLabel,
  MED_INTERVAL_OPTIONS, MedicationSlot, SLOT_STATUS_LABELS,
} from '../utils/medication';
import { exportMedicationIcs, IcsShareMode, MED_ICS_DISPLAY_NAME } from '../utils/calendarIcs';

/**
 * 用药管理页：隔天一次（48h）长期用药的打卡 + 提醒 + 历史。
 * 与现有健身页保持同一套设计语言：FITCUSTOM PRO 页眉、卡片分区、语义色 Badge，
 * 所有确认走 ConfirmSheet，不出现 window.confirm。
 */
interface MedicationViewProps {
  med: MedicationController;
  /** 返回上一页（本页不再是底部导航 tab，从「计划分化」进入） */
  onBack?: () => void;
}

const PERMISSION_HINT = {
  granted: '系统通知已授权，到点会弹提醒',
  denied: '系统通知被关掉了：请到「设置 → 通知 → FitCustom Pro」手动打开',
  prompt: '还没有通知权限，点下方按钮开启',
  unsupported: '当前环境不支持系统通知（网页预览），仅显示应用内提醒',
} as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-150',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function StatTile({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'success' | 'danger' | 'accent' }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="rounded-card border border-line bg-surface px-2.5 py-2">
      <p className="text-cap text-ink-3">{label}</p>
      <p className={cx('mt-0.5 flex items-baseline gap-0.5', toneClass)}>
        <NumberText size="lg">{value}</NumberText>
        {unit && <span className="text-cap font-medium text-ink-3">{unit}</span>}
      </p>
    </div>
  );
}

function statusTone(slot: MedicationSlot): 'success' | 'danger' | 'warning' | 'accent' | 'neutral' {
  switch (slot.status) {
    case 'taken':
      return 'success';
    case 'missed':
      return 'danger';
    case 'skipped':
      return 'neutral';
    case 'pending':
      return 'accent';
    default:
      return 'neutral';
  }
}

function slotStatusText(slot: MedicationSlot): string {
  if (slot.status === 'taken') {
    return slot.late ? `逾期补记 ${formatClock(slot.dose?.takenAt ?? 0)}` : `已服用 ${formatClock(slot.dose?.takenAt ?? 0)}`;
  }
  if (slot.status === 'skipped') return '已跳过';
  if (slot.status === 'missed') return '漏服';
  if (slot.status === 'pending') return '待服用';
  return '待服用';
}

export function MedicationView({ med, onBack }: MedicationViewProps) {
  const { config, state, permission, permissionInfo, doses, scheduled } = med;
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [draftName, setDraftName] = useState(config.name);
  const [draftDosage, setDraftDosage] = useState(config.dosage);
  const [undoDose, setUndoDose] = useState<{ id: string; label: string } | null>(null);
  const [skipSlotDate, setSkipSlotDate] = useState<string | null>(null);
  // 权限按钮点击后置忙，避免"点了没反应"的错觉（系统对话框可能延迟弹出）
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  // 导出 .ics 到系统日历：busy 防连点，result 用来回显结果
  const [icsBusy, setIcsBusy] = useState(false);
  const [icsResult, setIcsResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dueSlot = state.dueSlot;
  const dueNow = state.isDue;
  const takenToday = state.takenToday;
  const isTodaySlot = Boolean(dueSlot && dueSlot.date === state.today);
  const isOverdue = Boolean(dueSlot && dueSlot.date < state.today);
  const canRecord = Boolean(state.todaySlot);
  const todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

  const nextLabel = useMemo(() => {
    if (dueSlot) {
      return `${formatSlotLabel(dueSlot.date)} ${config.reminderTime}`;
    }
    const next = state.upcoming[0];
    return next ? `${formatSlotLabel(next.date)} ${config.reminderTime}` : '—';
  }, [dueSlot, state.upcoming, config.reminderTime]);

  const countdownText = useMemo(() => {
    if (dueSlot) {
      return dueNow ? formatOverdue(state.overdueMs) : formatCountdown(dueSlot.dueAt - med.now);
    }
    const next = state.upcoming[0];
    return next ? formatCountdown(next.dueAt - med.now) : '—';
  }, [dueSlot, dueNow, state.upcoming, state.overdueMs, med.now]);

  const historyRows = historyExpanded ? state.history.slice(0, 30) : state.history.slice(0, 8);
  const hasRecords = doses.length > 0;

  const handleExportIcs = async (mode: IcsShareMode) => {
    if (icsBusy) return;
    setIcsBusy(true);
    try {
      const result = await exportMedicationIcs(config, mode);
      setIcsResult({ ok: result.ok, message: result.message });
    } finally {
      setIcsBusy(false);
    }
  };

  const handleRequestPermission = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    setPermissionNote(null);
    try {
      const info = await med.requestPermission();
      if (info.permission === 'granted') {
        setPermissionNote('已获得通知权限，提醒已重新排期。');
      } else {
        // 系统对话框被系统静默拒绝（Android 13+ 二次拒绝后不再弹窗）时，明确引导去设置页
        setPermissionNote('系统没有弹出授权框：说明已被永久拒绝，请点「打开系统通知设置」手动打开。');
      }
    } finally {
      setPermissionBusy(false);
    }
  };

  const recheckPermission = async () => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    try {
      const info = await med.recheckPermission();
      setPermissionNote(
        info.permission === 'granted'
          ? '检测到通知已开启，提醒已重新排期。'
          : '仍未开启，请到系统设置里允许 FitCustom Pro 发送通知。',
      );
    } finally {
      setPermissionBusy(false);
    }
  };

  // 诊断行：把插件值与系统值都摊开，用户截图即可定位问题
  const diagnostics = useMemo(() => {
    const plugin = permissionInfo.pluginPermission;
    const native = permissionInfo.nativeEnabled;
    const nativeText = native === null ? '未知' : native ? '已开启' : '已关闭';
    const parts = [`运行时权限：${plugin}`, `系统通知：${nativeText}`];
    if (state.stepDays > 0 && permission === 'granted') parts.push(`已排期 ${scheduled} 条`);
    if (permissionInfo.error) parts.push(`错误：${permissionInfo.error}`);
    return parts.join(' · ');
  }, [permissionInfo, permission, scheduled, state.stepDays]);

  const submitInfoSheet = () => {
    med.updateConfig({ name: draftName.trim() || config.name, dosage: draftDosage.trim() });
    setInfoSheetOpen(false);
  };

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* 页眉：与训练 / 计划 / 动作库 / 日志一致 */}
      <header>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-1 flex items-center gap-0.5 rounded-ctl py-1 pr-2 text-sm2 font-medium text-ink-3 transition-colors hover:text-ink active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
            计划分化
          </button>
        )}
        <div className="flex items-center justify-between text-cap font-semibold uppercase tracking-[0.08em] text-ink-3">
          <span>FITCUSTOM PRO</span>
          <span>{todayLabel}</span>
        </div>
        <h1 className="mt-0.5 text-h1 font-bold tracking-tight text-ink">用药管理</h1>
        <p className="mt-1 text-sm2 text-ink-2">
          {config.name} · {intervalLabel(config)} · {config.reminderTime} 提醒
        </p>
      </header>

      {/* 今日状态卡 */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Pill className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-h2 font-semibold text-ink">{config.name}</p>
              <p className="text-cap text-ink-3">{config.dosage || '剂量未填写'} · {intervalLabel(config)}</p>
            </div>
          </div>
          {dueNow ? (
            <Badge tone="danger">{isOverdue ? '漏服待补' : '待服用'}</Badge>
          ) : takenToday ? (
            <Badge tone="success">今日已完成</Badge>
          ) : isTodaySlot ? (
            <Badge tone="accent">今日应服</Badge>
          ) : (
            <Badge tone="neutral">今日无需</Badge>
          )}
        </div>

        {/* 主操作区 */}
        {dueNow ? (
          <div className="mt-3 rounded-card border border-accent/30 bg-accent-soft/60 p-3.5">
            <p className="text-body font-semibold text-ink">
              {isOverdue ? `漏服待补记（应服日 ${dueSlot ? formatSlotLabel(dueSlot.date) : ''}）` : '今天该吃药了'}
            </p>
            <p className="mt-0.5 text-sm2 text-ink-2">
              {isOverdue ? countdownText : `应服时间 ${config.reminderTime}`}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" size="lg" block onClick={() => med.markTaken()}>
                <Check className="h-4 w-4" />
                一键标记已服用
              </Button>
              {isOverdue && dueSlot && (
                <Button variant="ghost" size="lg" onClick={() => setSkipSlotDate(dueSlot.date)}>
                  <SkipForward className="h-4 w-4" />
                  跳过
                </Button>
              )}
            </div>
          </div>
        ) : takenToday ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-card bg-success-soft px-3.5 py-3">
            <Check className="h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-success">
                今日已服用 {formatClock(takenToday.takenAt)}
              </p>
              <p className="text-cap text-ink-2">下次 {nextLabel}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setUndoDose({
                  id: takenToday.id,
                  label: formatSlotLabel(state.todaySlot?.date ?? state.today),
                })
              }
              className="h-11 shrink-0 px-1 text-sm2 font-semibold text-ink-3 underline hover:text-danger"
            >
              撤销
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-card bg-surface-subtle px-3.5 py-3">
            <p className="text-body font-semibold text-ink">
              {isTodaySlot ? `今天 ${config.reminderTime} 应服` : '今天无需服药'}
            </p>
            <p className="mt-0.5 text-sm2 text-ink-2">
              {isTodaySlot ? `还有 ${countdownText}` : `下次应服 ${nextLabel}`}
            </p>
            {isTodaySlot && canRecord && (
              <Button variant="outline" className="mt-2.5" onClick={() => med.markTaken()}>
                <Check className="h-4 w-4" />
                提前记录已服用
              </Button>
            )}
          </div>
        )}

        {/* 下次应服 / 倒计时 */}
        <div className="mt-3 flex items-center justify-between rounded-ctl bg-surface-subtle px-3 py-2">
          <span className="text-cap font-semibold text-ink-3">下次应服</span>
          <span className="text-sm2 font-semibold tabular-nums text-ink">
            {nextLabel}
            <span className="ml-1.5 font-medium text-ink-3">{countdownText}</span>
          </span>
        </div>
      </Card>

      {/* 最近 7 个槽位的状态链 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-cap font-semibold uppercase tracking-[0.08em] text-ink-3">最近用药</p>
          {state.lastTaken && (
            <p className="text-cap text-ink-3">上次 {formatSlotLabel(dayOf(state.lastTaken.takenAt))}</p>
          )}
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-1">
          {state.chain.length === 0 && <p className="text-sm2 text-ink-3">还没有记录</p>}
          {state.chain.map(slot => (
            <div key={slot.date} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cx(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold',
                  slot.status === 'taken' && 'border-success/30 bg-success-soft text-success',
                  slot.status === 'missed' && 'border-danger/30 bg-danger-soft text-danger',
                  slot.status === 'skipped' && 'border-line-strong bg-surface-subtle text-ink-3',
                  (slot.status === 'pending' || slot.status === 'upcoming') && 'border-accent/40 bg-accent-soft text-accent',
                )}
              >
                {slot.status === 'taken' ? <Check className="h-3.5 w-3.5" /> : slot.status === 'missed' ? '!' : slot.status === 'skipped' ? '–' : '·'}
              </span>
              <span className="text-[10px] tabular-nums text-ink-3">{slot.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="累计服用" value={String(state.stats.taken)} unit="次" />
        <StatTile label="连续" value={String(state.streak)} unit="次" tone="success" />
        <StatTile label="漏服" value={String(state.stats.missed)} unit="次" tone={state.stats.missed > 0 ? 'danger' : undefined} />
        <StatTile label="依从率" value={state.stats.total > 0 ? String(state.stats.rate) : '—'} unit={state.stats.total > 0 ? '%' : ''} tone="accent" />
      </div>

      {/* 历史记录 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-h2 font-semibold text-ink">服药记录</p>
          <span className="text-cap text-ink-3">近 90 天 · 漏服 {state.stats.missed} 次</span>
        </div>

        {!hasRecords && state.stats.total === 0 ? (
          <p className="mt-3 rounded-ctl bg-surface-subtle px-3 py-3 text-sm2 text-ink-2">
            还没有服药记录。点上面的「一键标记已服用」开始，之后这里会显示每次是否按时。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {historyRows.map(slot => (
              <li key={slot.date} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-body font-semibold text-ink">
                    {formatSlotLabel(slot.date)}
                    {slot.date === state.today && <span className="text-cap font-medium text-ink-3">今天</span>}
                  </p>
                  <p className={cx('text-cap', slot.status === 'missed' ? 'text-danger' : 'text-ink-2')}>
                    {slotStatusText(slot)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone={statusTone(slot)}>{SLOT_STATUS_LABELS[slot.status]}</Badge>
                  {slot.dose ? (
                    <IconButton
                      label="撤销这条记录"
                      tone="danger"
                      onClick={() => setUndoDose({ id: slot.dose!.id, label: formatSlotLabel(slot.date) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  ) : (
                    <button
                      type="button"
                      onClick={() => med.markTaken(slot.date)}
                      className="h-11 rounded-ctl px-2 text-sm2 font-semibold text-accent hover:bg-accent-soft"
                    >
                      补记
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {state.history.length > 8 && (
          <button
            type="button"
            onClick={() => setHistoryExpanded(value => !value)}
            className="mt-1 flex h-11 w-full items-center justify-center gap-1 rounded-ctl text-sm2 font-semibold text-ink-2 hover:bg-surface-subtle"
          >
            {historyExpanded ? '收起' : `展开全部（${state.history.length} 次）`}
            {historyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </Card>

      {/* 提醒设置 */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-h2 font-semibold text-ink">
              {config.reminderEnabled ? <BellRing className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-ink-3" />}
              到点提醒
            </p>
            <p className="mt-0.5 text-cap text-ink-2">
              每 {state.stepDays} 天一次 · {config.reminderTime}
            </p>
          </div>
          <Toggle
            label="到点提醒"
            checked={config.reminderEnabled}
            onChange={value => med.updateConfig({ reminderEnabled: value })}
          />
        </div>

        {config.reminderEnabled && permission !== 'granted' && (
          <div className="mt-3 rounded-ctl bg-warning-soft px-3 py-2.5">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm2 font-medium text-ink">{PERMISSION_HINT[permission]}</p>
                <p className="mt-0.5 text-cap leading-relaxed text-ink-2">{diagnostics}</p>
                {permissionNote && (
                  <p className="mt-1 text-cap leading-relaxed text-ink-2">{permissionNote}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {permission === 'prompt' && (
                    <Button
                      size="md"
                      variant="outline"
                      disabled={permissionBusy}
                      onClick={() => void handleRequestPermission()}
                    >
                      {permissionBusy ? '请求中…' : '开启通知权限'}
                    </Button>
                  )}
                  {permission !== 'unsupported' && (
                    <Button
                      size="md"
                      variant="outline"
                      disabled={permissionBusy}
                      onClick={() => void med.openNotificationSettings()}
                    >
                      打开系统通知设置
                    </Button>
                  )}
                  <Button size="md" variant="ghost" disabled={permissionBusy} onClick={() => void recheckPermission()}>
                    重新检测
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {config.reminderEnabled && permission === 'granted' && (
          <p className="mt-2 flex items-center gap-1.5 text-cap text-ink-3">
            <Check className="h-3.5 w-3.5 text-success" />
            通知已开启 · 已排期 {scheduled} 条
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="med-time" className="flex items-center gap-1.5 text-body text-ink">
              <Clock className="h-4 w-4 text-ink-3" />
              提醒时间
            </label>
            <input
              id="med-time"
              type="time"
              value={config.reminderTime}
              onChange={event => {
                if (event.target.value) med.updateConfig({ reminderTime: event.target.value });
              }}
              className="h-9 rounded-ctl border border-line bg-surface px-2.5 text-sm2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-1.5 text-body text-ink">服药间隔</p>
            <SegmentedControl
              label="服药间隔"
              value={String(config.intervalHours)}
              onChange={value => med.updateConfig({ intervalHours: Number(value) })}
              options={MED_INTERVAL_OPTIONS.map(option => ({ value: option.value, label: option.label }))}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="med-start" className="text-body text-ink">首剂日期</label>
            <input
              id="med-start"
              type="date"
              value={config.startDate}
              onChange={event => {
                if (event.target.value) med.updateConfig({ startDate: event.target.value });
              }}
              className="h-9 rounded-ctl border border-line bg-surface px-2.5 text-sm2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setDraftName(config.name);
              setDraftDosage(config.dosage);
              setInfoSheetOpen(true);
            }}
            className="flex h-11 w-full items-center justify-between rounded-ctl px-1 text-body text-ink hover:bg-surface-subtle"
          >
            <span>药品与剂量</span>
            <span className="text-sm2 font-semibold text-ink-2">
              {config.name} · {config.dosage || '未填写'} ›
            </span>
          </button>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-cap leading-relaxed text-ink-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          提醒由系统闹钟触发，不依赖 App 在后台运行；国产 ROM 请把本应用加入「自启动 / 后台运行」白名单，避免被清理后不响。
        </p>
      </Card>

      {/* 系统日历（可选）：导出 .ics，由日历自己重复提醒，作为 App 通知之外的第二道保险 */}
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-h2 font-semibold text-ink">
          <CalendarPlus className="h-4 w-4 text-accent" />
          系统日历提醒
        </p>
        <p className="mt-1 text-cap leading-relaxed text-ink-2">
          导出 .ics 导入日历后，会得到一条「每 {state.stepDays} 天 {config.reminderTime}」的重复事件，
          由系统日历负责提醒，即使 App 被清理也不会漏。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={icsBusy}
            onClick={() => void handleExportIcs('open')}
          >
            <CalendarPlus className="h-4 w-4" />
            {icsBusy ? '正在生成…' : '用系统日历打开'}
          </Button>
          <Button
            variant="outline"
            size="md"
            disabled={icsBusy}
            onClick={() => void handleExportIcs('share')}
          >
            分享 / 保存文件
          </Button>
        </div>
        <ol className="mt-3 space-y-1 text-cap leading-relaxed text-ink-3">
          <li>1. 点「用系统日历打开」，App 会直接唤起居中的日历导入界面（不走分享面板）。</li>
          <li>2. 日历里确认导入后，会得到一条每 {state.stepDays} 天 {config.reminderTime} 的重复事件。</li>
          <li>3. 若手机没有可响应的日历，用「分享 / 保存文件」把 {MED_ICS_DISPLAY_NAME} 存到本地，再用日历打开。</li>
          <li>4. 重复导入不会产生重复事件（事件 ID 固定），改时间后重新导入即可覆盖。</li>
        </ol>
      </Card>

      {/* 药名/剂量编辑 */}
      <Sheet
        open={infoSheetOpen}
        onClose={() => setInfoSheetOpen(false)}
        title="药品与剂量"
        description="显示在提醒通知与页眉上的名称"
        footer={<Button variant="primary" block onClick={submitInfoSheet}>保存</Button>}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="med-name" className="mb-1 block text-sm2 font-medium text-ink-2">药品名称</label>
            <input
              id="med-name"
              value={draftName}
              onChange={event => setDraftName(event.target.value)}
              placeholder="非那雄胺"
              className="h-11 w-full rounded-ctl border border-line bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="med-dosage" className="mb-1 block text-sm2 font-medium text-ink-2">剂量</label>
            <input
              id="med-dosage"
              value={draftDosage}
              onChange={event => setDraftDosage(event.target.value)}
              placeholder="1 mg"
              className="h-11 w-full rounded-ctl border border-line bg-surface px-3 text-body text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(icsResult)}
        onClose={() => setIcsResult(null)}
        title={icsResult?.ok ? '日历文件已生成' : '导出失败'}
        description={icsResult?.message}
        footer={
          <Button variant="primary" block onClick={() => setIcsResult(null)}>
            知道了
          </Button>
        }
      >
        <div className="space-y-2 text-sm2 leading-relaxed text-ink-2">
          <p>
            文件里已经写好重复规则（每 {state.stepDays} 天一次、{config.reminderTime} 开始）与到点提醒，
            导入一次之后由系统日历自己负责，不需要再回 App 操作。
          </p>
          <p className="text-ink-3">
            注意：日历事件与 App 内通知是两套提醒，两边都开时可能同一时间收到两条提醒；
            只想要其中一边，可以在日历里删掉事件，或关掉上方的「到点提醒」开关。
          </p>
        </div>
      </Sheet>

      <ConfirmSheet
        open={Boolean(undoDose)}
        title="撤销这条服药记录？"
        description={undoDose ? `${undoDose.label} 的记录会被删除，该次恢复为未记录。` : ''}
        confirmText="撤销记录"
        danger
        onCancel={() => setUndoDose(null)}
        onConfirm={() => {
          if (undoDose) med.removeDose(undoDose.id);
          setUndoDose(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(skipSlotDate)}
        title="跳过一次服药？"
        description="本次记为「已跳过」，不计入漏服，也不影响后续周期；下一槽位照常提醒。"
        confirmText="跳过本次"
        danger={false}
        onCancel={() => setSkipSlotDate(null)}
        onConfirm={() => {
          if (skipSlotDate) med.skipSlot(skipSlotDate);
          setSkipSlotDate(null);
        }}
      />
    </div>
  );
}

function dayOf(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
