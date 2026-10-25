import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, Plus, TrendingDown, TrendingUp,
  Trash2, Download, Upload, CheckCircle2, MessageSquare, AlertCircle,
  Flame, Check, ChevronDown, ChevronUp,
  Layers, Coffee, Target, CalendarDays, Zap, Pencil
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  WeightLog, WorkoutSession, UnilateralSide, Exercise, DropStage,
  MuscleCategory, ResistanceUnit, PulleyRatio
} from '../types';
import { StorageService } from '../utils/storage';
import { todayLocalDate, shiftLocalDate, weekdayOf } from '../utils/date';
import {
  sessionVolumes, formatVolumeShort, sessionDurationMin,
  countWeekTrainings, computeStreak, totalCompletedSetsAll,
} from '../utils/stats';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { ConfirmSheet } from './ConfirmSheet';
import { Badge, Button, Card, IconButton, NumberText, SegmentedControl, Sheet, cx } from '../ui';

interface WeightJournalViewProps {
  onDataChanged?: () => void;
  allExercises?: Exercise[];
}

const SLOT_SHORT: Record<string, string> = {
  'morning': '晨起',
  'evening': '晚间',
  'post-workout': '练后',
};

type SlotKey = 'morning' | 'evening' | 'post-workout';

const SLOT_OPTIONS = [
  { value: 'morning', label: '晨起空腹' },
  { value: 'post-workout', label: '练后即刻' },
  { value: 'evening', label: '晚间睡前' },
] as const;

const HISTORY_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'training', label: '训练' },
  { value: 'rest', label: '休息' },
] as const;

const SLOT_FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'morning', label: '晨起' },
  { value: 'post-workout', label: '练后' },
  { value: 'evening', label: '晚间' },
] as const;

const CHART_SPAN_OPTIONS = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'all', label: '全部' },
] as const;

const CARDIO_MODE_OPTIONS = [
  { value: 'none', label: '无有氧' },
  { value: 'yes', label: '有有氧' },
] as const;

// 历史编辑规格抽屉：单位与滑轮（选项文案与开练页规格抽屉对齐）
const EDIT_UNIT_OPTIONS = [
  { value: 'plates', label: '插销' },
  { value: 'kg', label: 'kg' },
  { value: 'assisted', label: '助力' },
  { value: 'bodyweight', label: '自重' },
] as const;

const EDIT_PULLEY_OPTIONS = [
  { value: 'none', label: '无' },
  { value: '1:1', label: '1:1' },
  { value: '2:1', label: '2:1' },
] as const;

// 输入框统一样式串：与 WorkoutView 的 fieldCls 完全一致
const fieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';

// 历史编辑：规格胶囊与抽屉的简标（与开练页 WorkoutView 保持一致）
const EDIT_UNIT_SHORT: Record<ResistanceUnit, string> = {
  plates: '插销',
  kg: '重量',
  assisted: '助力',
  bodyweight: '自重',
};
const EDIT_PULLEY_SHORT: Record<PulleyRatio, string> = {
  none: '普通器械',
  '1:1': '单滑轮',
  '2:1': '双滑轮',
};

// 历史编辑：默认递减四阶（与动作库/计划页默认阶梯一致）
const EDIT_DEFAULT_DROP_STAGES: DropStage[] = [
  { id: 'edit-stg-1', weightOrPlates: 10, unit: 'kg', reps: 12 },
  { id: 'edit-stg-2', weightOrPlates: 7.5, unit: 'kg', reps: 12 },
  { id: 'edit-stg-3', weightOrPlates: 5, unit: 'kg', reps: 10 },
  { id: 'edit-stg-4', weightOrPlates: 2.5, unit: 'kg', reps: 12 },
];

// 深拷贝默认四阶并生成唯一 id，避免多个大组共享同一数组引用
const makeEditDefaultDropStages = (): DropStage[] =>
  EDIT_DEFAULT_DROP_STAGES.map((stg, i) => ({ ...stg, id: `edit-stg-${Date.now()}-${i}` }));

export const WeightJournalView: React.FC<WeightJournalViewProps> = ({
  onDataChanged,
  allExercises,
}) => {
  // 当前子标签: 'training' | 'weight'
  const [activeSubTab, setActiveSubTab] = useState<'training' | 'weight'>('training');

  // 训练记录列表与展开状态集合
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  // 历史筛选：全部 / 训练 / 休息
  const [historyFilter, setHistoryFilter] = useState<'all' | 'training' | 'rest'>('all');
  // 活动日历选中的日期（点格子过滤）
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // 体重日志列表与输入状态
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [inputWeight, setInputWeight] = useState('');
  const [inputDate, setInputDate] = useState(() => todayLocalDate());
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  // 备份区就近提示（导出/分享结果），5 秒后自动清空
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  // 体重目标
  const [weightGoal, setWeightGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  // 时段过滤：all / morning / post-workout / evening
  const [slotFilter, setSlotFilter] = useState<'all' | SlotKey>('all');
  // 体重打卡日历选中的日期
  const [selectedWeightDate, setSelectedWeightDate] = useState<string | null>(null);

  // 体重曲线时间跨度视图: 'week' (周视图/7天) | 'month' (月视图/30天) | 'all' (全部)
  const [chartViewSpan, setChartViewSpan] = useState<'week' | 'month' | 'all'>('week');

  // 统一确认抽屉（删除/恢复操作）
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; confirmText: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmText: '确认删除', onConfirm: () => {} });

  // 历史训练编辑：正在编辑的会话深拷贝（同 id 写回，休息日仅可改备注）
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  // 历史编辑：当前打开规格抽屉（单位 + 滑轮）的动作索引
  const [editSpecExIdx, setEditSpecExIdx] = useState<number | null>(null);

  // 体重目标编辑为页内折叠块（非浮层），仍需锁底层滚动；其余弹层由 Sheet/ConfirmSheet 自行加锁
  useLockBodyScroll(confirmState.open || showGoalEditor);

  // 历史编辑弹窗内的自定义新动作折叠表单状态
  const [showHistoryCustomForm, setShowHistoryCustomForm] = useState(false);
  const [historyCustomName, setHistoryCustomName] = useState('');
  const [historyCustomCategory, setHistoryCustomCategory] = useState<MuscleCategory>('chest');
  const [historyCustomUnit, setHistoryCustomUnit] = useState<ResistanceUnit>('plates');
  const [historyCustomPulley, setHistoryCustomPulley] = useState<PulleyRatio>('none');
  const [historyCustomUnilateral, setHistoryCustomUnilateral] = useState(false);
  const [historyCustomNotes, setHistoryCustomNotes] = useState('');
  const [historyCustomError, setHistoryCustomError] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const wList = StorageService.getWeightLogs();
    const sList = StorageService.getSessions();
    setWeights(wList);
    setSessions(sList);
    setWeightGoal(StorageService.getWeightGoal());
  };

  // 切换单条训练展开/折叠
  const toggleExpandSession = (sessionId: string) => {
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // 一键全部展开 / 全部收起（只针对当前过滤后的列表）
  const toggleAllSessions = (visibleIds: string[]) => {
    const allVisibleExpanded = visibleIds.every(id => expandedSessionIds.has(id));
    if (allVisibleExpanded) {
      setExpandedSessionIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setExpandedSessionIds(prev => new Set([...prev, ...visibleIds]));
    }
  };

  // 检查选中的 inputDate 是否已经打过卡
  const existingTodayLog = weights.find(w => w.date === inputDate);
  const isAlreadyLogged = Boolean(existingTodayLog) && !isEditingExisting;

  // 当日期切换时，如果有旧数据自动载入并设置状态
  useEffect(() => {
    const existing = weights.find(w => w.date === inputDate);
    if (existing) {
      setInputWeight(existing.weight.toString());
      setInputSlot(existing.timeSlot || 'morning');
      setInputNote(existing.note || '');
      setIsEditingExisting(false);
    } else {
      // 新的一天没有记录时清空表单，避免残留上一次的体重/备注
      setInputWeight('');
      setInputNote('');
      setInputSlot('morning');
      setIsEditingExisting(false);
    }
  }, [inputDate, weights]);

  // 提交打卡
  const [formError, setFormError] = useState<string | null>(null);
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyLogged) return;

    const val = parseFloat(inputWeight);
    if (!val || val <= 0) {
      setFormError('请输入正确的体重数字！');
      setTimeout(() => setFormError(null), 2500);
      return;
    }

    StorageService.addWeightLog({
      date: inputDate,
      weight: val,
      timeSlot: inputSlot,
      note: inputNote.trim(),
    });

    setIsEditingExisting(false);
    refreshData();
    if (onDataChanged) onDataChanged();
  };

  // 保存体重目标
  const handleSaveGoal = () => {
    const v = parseFloat(goalInput);
    if (!v || v <= 0) {
      setFormError('请输入正确的目标体重！');
      setTimeout(() => setFormError(null), 2500);
      return;
    }
    StorageService.saveWeightGoal(v);
    setWeightGoal(v);
    setShowGoalEditor(false);
    if (onDataChanged) onDataChanged();
  };

  // 唤起删除体重确认
  const promptDeleteWeight = (id: string, date: string, weightVal: number) => {
    setConfirmState({
      open: true,
      title: '删除体重记录',
      description: `确定要彻底删除 ${date} 的 ${weightVal}kg 体重打卡记录吗？删除后将不再复原。`,
      confirmText: '确认删除',
      onConfirm: () => {
        StorageService.deleteWeightLog(id);
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      },
    });
  };

  // 唤起删除训练确认
  const promptDeleteSession = (sessionId: string, planName: string, date: string) => {
    setConfirmState({
      open: true,
      title: '删除历史训练记录',
      description: `确定要彻底删除 ${date} 的 “${planName}” 训练记录吗？此操作无法撤销。`,
      confirmText: '确认删除',
      onConfirm: () => {
        StorageService.deleteSession(sessionId);
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      },
    });
  };

  // ================= 历史训练记录编辑（同 id 写回） =================
  const startEditSession = (sess: WorkoutSession) => {
    // 深拷贝，避免编辑过程中污染列表中的原始对象
    setEditingSession(JSON.parse(JSON.stringify(sess)) as WorkoutSession);
  };

  const cancelEditSession = () => setEditingSession(null);

  const saveEditSession = () => {
    if (!editingSession) return;
    // 保存前统一有氧字段语义：无有氧 = false/0 且清空类型备注；有有氧 = 时长至少 1 分钟
    const normalized = JSON.parse(JSON.stringify(editingSession)) as WorkoutSession;
    if (normalized.isRestDay) {
      normalized.cardioCompleted = false;
      normalized.cardioMinutes = 0;
      normalized.cardioType = '';
      normalized.cardioNotes = '';
    } else if (normalized.cardioCompleted) {
      const mins = Math.round(normalized.cardioMinutes || 0);
      normalized.cardioMinutes = mins > 0 ? mins : 20;
      normalized.cardioType = (normalized.cardioType || '').trim() || '跑步机坡度快走';
    } else {
      normalized.cardioMinutes = 0;
      normalized.cardioType = '';
      normalized.cardioNotes = '';
    }
    // addSession 对同 id 做原地替换，因此编辑是覆盖写回而非新增
    StorageService.addSession(normalized);
    setEditingSession(null);
    refreshData();
    if (onDataChanged) onDataChanged();
    setImportStatus('已保存历史记录修改');
    setTimeout(() => setImportStatus(null), 2500);
  };

  // 在编辑草稿上做不可变更新
  const patchEditing = (fn: (draft: WorkoutSession) => void) => {
    setEditingSession(prev => {
      if (!prev) return prev;
      const draft = JSON.parse(JSON.stringify(prev)) as WorkoutSession;
      fn(draft);
      return draft;
    });
  };

  const editSetField = (exIdx: number, setIdx: number, field: 'weightOrPlates' | 'reps', val: number) =>
    patchEditing(d => { d.exercises[exIdx].sets[setIdx][field] = Math.max(0, val); });

  const editUnilateralField = (
    exIdx: number, setIdx: number, side: 'left' | 'right', field: 'weight' | 'reps', val: number
  ) =>
    patchEditing(d => {
      const s = d.exercises[exIdx].sets[setIdx];
      const base: UnilateralSide = s[side] || { weight: s.weightOrPlates, reps: s.reps };
      const next: UnilateralSide = { weight: base.weight, reps: base.reps };
      next[field] = Math.max(0, val);
      s[side] = next;
      s.unilateral = true;
      // 主字段保持左侧副本，兼容未分侧展示与容量统计
      if (s.left) {
        s.weightOrPlates = s.left.weight;
        s.reps = s.left.reps;
      }
    });

  const editRemoveSet = (exIdx: number, setIdx: number) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      if (ex.sets.length <= 1) return;
      ex.sets.splice(setIdx, 1);
      ex.sets.forEach((s, i) => { s.setNumber = i + 1; });
    });

  const editSessionNotes = (val: string) => patchEditing(d => { d.notes = val; });
  const editExerciseNotes = (exIdx: number, val: string) =>
    patchEditing(d => { d.exercises[exIdx].notes = val; });

  // 历史编辑：动作改名（仅改本条记录的显示名，不动动作库）
  const editExerciseName = (exIdx: number, val: string) =>
    patchEditing(d => { d.exercises[exIdx].exerciseName = val; });

  // 历史编辑：切换计量单位（整组同步）——片 / kg / 助力 / 自重
  const editChangeUnit = (exIdx: number, unit: ResistanceUnit) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      if (!ex) return;
      ex.currentUnit = unit;
      ex.sets.forEach(s => { s.unit = unit; });
    });

  // 历史编辑：切换滑轮比例（整组同步）——普通 / 单滑轮 1:1 / 双滑轮 2:1
  const editChangePulley = (exIdx: number, ratio: PulleyRatio) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      if (!ex) return;
      ex.pulleyRatio = ratio;
      ex.sets.forEach(s => { s.pulleyRatio = ratio; });
    });

  // 历史编辑：切换单双侧；切到单侧时左右默认取主字段值，切回双侧保留数据仅不再分侧展示
  // 单侧与超级组互斥：切到单侧时清除该动作各组的超级组标记与阶梯
  const editToggleUnilateral = (exIdx: number, on: boolean) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      ex.isUnilateral = on || undefined;
      ex.sets.forEach(s => {
        if (on) {
          if (s.isDropSet) {
            s.isDropSet = undefined;
            s.dropStages = undefined;
          }
          s.unilateral = true;
          if (!s.left) s.left = { weight: s.weightOrPlates, reps: s.reps };
          if (!s.right) s.right = { weight: s.weightOrPlates, reps: s.reps };
        } else {
          s.unilateral = undefined;
        }
      });
    });

  // 历史编辑：切换递减超级组（整组动作；开启时每组深拷贝一份默认四阶）
  // 超级组与单侧互斥：开启超级组时清除单侧标记与左右值，组单位统一为 kg
  const editToggleDropSet = (exIdx: number, on: boolean) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      ex.sets.forEach(s => {
        if (on) {
          s.unilateral = undefined;
          s.left = undefined;
          s.right = undefined;
          s.isDropSet = true;
          const stages = makeEditDefaultDropStages();
          s.dropStages = stages;
          s.unit = 'kg';
          s.weightOrPlates = stages[0].weightOrPlates;
          s.reps = stages[0].reps;
        } else {
          s.isDropSet = undefined;
          s.dropStages = undefined;
        }
      });
      if (on) ex.isUnilateral = undefined;
    });

  // 历史编辑：有氧开关与明细；无有氧时清空时长/类型/备注，保证展示与保存一致
  const editCardioMode = (enabled: boolean) =>
    patchEditing(d => {
      d.cardioCompleted = enabled;
      if (enabled) {
        d.cardioMinutes = d.cardioMinutes && d.cardioMinutes > 0 ? d.cardioMinutes : 20;
        d.cardioType = (d.cardioType || '').trim() || '跑步机坡度快走';
      } else {
        d.cardioMinutes = 0;
        d.cardioType = '';
        d.cardioNotes = '';
      }
    });
  const editCardioMinutes = (val: number) =>
    patchEditing(d => { d.cardioMinutes = Math.max(0, Math.round(val)); });
  const editCardioType = (val: string) =>
    patchEditing(d => { d.cardioType = val; });
  const editCardioNotes = (val: string) =>
    patchEditing(d => { d.cardioNotes = val; });

  // 历史编辑：加一组（复制末组，单侧复制左右）
  const editAddSet = (exIdx: number) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      const last = ex.sets[ex.sets.length - 1];
      if (!last) return;
      const copy = JSON.parse(JSON.stringify(last));
      copy.id = `s-edit-${Date.now()}`;
      copy.setNumber = ex.sets.length + 1;
      copy.completed = true;
      ex.sets.push(copy);
    });

  // 历史编辑：删除整组动作
  const editRemoveExercise = (exIdx: number) =>
    patchEditing(d => { d.exercises.splice(exIdx, 1); });

  // 历史编辑挑选替换动作：弹窗状态
  const [replaceExIdx, setReplaceExIdx] = useState<number | null>(null);
  const [replaceSearch, setReplaceSearch] = useState('');

  // 历史编辑：换动作（保留组数与备注，重量次数沿用原组；单侧按新动作标记重建左右）
  // 新动作带有效超级组阶梯时，按现有组数重建超级组大组（与新增动作的 asDrop 分支一致）
  const editReplaceExercise = (exIdx: number, neo: { id: string; name: string; category: WorkoutSession['exercises'][number]['category']; defaultUnit: WorkoutSession['exercises'][number]['currentUnit']; defaultPulley: WorkoutSession['exercises'][number]['pulleyRatio']; isUnilateral?: boolean; isDropSet?: boolean; dropStages?: DropStage[] }) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      const n = ex.sets.length || 1;
      // 动作库预设阶梯优先；无阶梯时超级组标记视为无效，回落普通或单侧分支
      const stages = neo.dropStages && neo.dropStages.length > 0 ? neo.dropStages : undefined;
      const asDrop = Boolean(neo.isDropSet && stages);
      ex.exerciseId = neo.id;
      ex.exerciseName = neo.name;
      ex.category = neo.category;
      ex.currentUnit = neo.defaultUnit;
      ex.pulleyRatio = neo.defaultPulley;
      // 超级组不支持分侧记录
      ex.isUnilateral = asDrop ? undefined : (neo.isUnilateral || undefined);
      ex.sets = Array.from({ length: n }, (_, i) => {
        const old = ex.sets[i];
        const w = old?.weightOrPlates ?? 30;
        const r = old?.reps ?? 12;
        const base = {
          id: `s-edit-${Date.now()}-${i}`,
          setNumber: i + 1,
          unit: neo.defaultUnit,
          weightOrPlates: w,
          reps: r,
          completed: true,
          pulleyRatio: neo.defaultPulley,
        };
        if (asDrop) {
          // 每个大组深拷贝一份阶梯，避免各大组共享同一数组引用
          const copiedStages: DropStage[] = JSON.parse(JSON.stringify(stages));
          return {
            ...base,
            unit: 'kg' as ResistanceUnit,
            weightOrPlates: copiedStages[0]?.weightOrPlates ?? 10,
            reps: copiedStages[0]?.reps ?? 12,
            isDropSet: true,
            dropStages: copiedStages,
          };
        }
        if (neo.isUnilateral) {
          const lw = old?.left?.weight ?? w;
          const lr = old?.left?.reps ?? r;
          const rw = old?.right?.weight ?? w;
          const rr = old?.right?.reps ?? r;
          return { ...base, unilateral: true, left: { weight: lw, reps: lr }, right: { weight: rw, reps: rr } };
        }
        return base;
      });
    });

  // 历史编辑：新增动作（从动作库挑选，默认 4 组；带超级组标记时生成 4 个超级组大组）
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExSearch, setAddExSearch] = useState('');
  const editAddExercise = (neo: { id: string; name: string; category: WorkoutSession['exercises'][number]['category']; defaultUnit: WorkoutSession['exercises'][number]['currentUnit']; defaultPulley: WorkoutSession['exercises'][number]['pulleyRatio']; isUnilateral?: boolean; isDropSet?: boolean; dropStages?: DropStage[] }) =>
    patchEditing(d => {
      const w = neo.defaultUnit === 'plates' ? 10 : 30;
      // 动作库预设阶梯优先；无阶梯时超级组标记视为无效，回落普通组
      const stages = neo.dropStages && neo.dropStages.length > 0 ? neo.dropStages : undefined;
      const asDrop = Boolean(neo.isDropSet && stages);
      const sets = Array.from({ length: 4 }, (_, i) => {
        const base = {
          id: `s-edit-${Date.now()}-${i + 1}`,
          setNumber: i + 1,
          unit: neo.defaultUnit,
          weightOrPlates: w,
          reps: 12,
          completed: true,
          pulleyRatio: neo.defaultPulley,
        };
        if (asDrop) {
          // 每个大组深拷贝一份阶梯，避免各大组共享同一数组引用
          const copiedStages: DropStage[] = JSON.parse(JSON.stringify(stages));
          return {
            ...base,
            unit: 'kg' as ResistanceUnit,
            weightOrPlates: copiedStages[0]?.weightOrPlates ?? 10,
            reps: copiedStages[0]?.reps ?? 12,
            isDropSet: true,
            dropStages: copiedStages,
          };
        }
        if (neo.isUnilateral) {
          return { ...base, unilateral: true, left: { weight: w, reps: 12 }, right: { weight: w, reps: 12 } };
        }
        return base;
      });
      d.exercises.push({
        exerciseId: neo.id,
        exerciseName: neo.name,
        category: neo.category,
        pulleyRatio: neo.defaultPulley,
        currentUnit: neo.defaultUnit,
        // 超级组不支持分侧记录
        isUnilateral: asDrop ? undefined : (neo.isUnilateral || undefined),
        sets,
        notes: '',
      });
    });

  // 备份区就近提示：5 秒后自动清空，避免只依赖页面顶部 importStatus
  const showBackupStatus = (type: 'success' | 'error', message: string) => {
    setBackupStatus({ type, message });
    setTimeout(() => setBackupStatus(null), 5000);
  };

  // 导出 JSON 备份：原生端写入 Cache 后调用系统分享，Web 端保留 Blob 下载
  const handleExportBackup = async () => {
    const jsonStr = StorageService.exportBackupJson();
    const fileName = `fitcustom-backup-${todayLocalDate()}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const written = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        try {
          await Share.share({
            url: written.uri,
            dialogTitle: '导出训练数据',
          });
          showBackupStatus('success', '备份已生成，可在分享面板保存或发送');
        } catch (shareErr) {
          const msg = shareErr instanceof Error ? shareErr.message : String(shareErr);
          // 用户取消分享时插件会 reject，此时文件已成功写入
          if (/cancel/i.test(msg)) {
            showBackupStatus('success', '已取消分享，备份文件仍已生成');
          } else {
            showBackupStatus('error', `导出失败：${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showBackupStatus('error', `导出失败：${msg}`);
      }
      return;
    }

    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showBackupStatus('success', '备份已下载');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showBackupStatus('error', `导出失败：${msg}`);
    }
  };

  // 导入 JSON 备份
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = StorageService.importBackupJson(content);
      if (success) {
        setImportStatus('备份数据恢复成功！');
        refreshData();
        if (onDataChanged) onDataChanged();
      } else {
        setImportStatus('导入失败，文件格式有误。');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  // ================= 训练历史统计 =================
  const todayStr = todayLocalDate();
  const historyStats = useMemo(() => ({
    trainings: sessions.filter(s => !s.isRestDay).length,
    rests: sessions.filter(s => s.isRestDay).length,
    weekTrainings: countWeekTrainings(sessions, todayStr),
    streak: computeStreak(sessions, todayStr),
    totalSets: totalCompletedSetsAll(sessions),
  }), [sessions, todayStr]);

  // 活动日历：近 8 周（56 天），以今天结尾
  const activityCal = useMemo(() => {
    const days: { date: string; day: number; isToday: boolean; hasTraining: boolean; hasRest: boolean }[] = [];
    const byDate = new Map<string, { t: boolean; r: boolean }>();
    for (const s of sessions) {
      const cur = byDate.get(s.date) || { t: false, r: false };
      if (s.isRestDay) cur.r = true; else cur.t = true;
      byDate.set(s.date, cur);
    }
    for (let i = 55; i >= 0; i--) {
      const date = shiftLocalDate(todayStr, -i);
      const info = byDate.get(date);
      days.push({
        date,
        day: Number(date.slice(8, 10)),
        isToday: i === 0,
        hasTraining: Boolean(info?.t),
        hasRest: Boolean(info?.r),
      });
    }
    return days;
  }, [sessions, todayStr]);

  // 过滤后的历史列表（类型筛选 + 日历日期筛选）
  const visibleSessions = useMemo(() => {
    return sessions.filter(s => {
      if (historyFilter === 'training' && s.isRestDay) return false;
      if (historyFilter === 'rest' && !s.isRestDay) return false;
      if (selectedCalDate && s.date !== selectedCalDate) return false;
      return true;
    });
  }, [sessions, historyFilter, selectedCalDate]);

  // ================= 体重统计与洞察 =================
  // 汇总栏只反映今天：没有今天的记录时保持空，不用上一次的数据冒充
  const todayWeightLog = weights.find(w => w.date === todayStr);
  const latestWeight = todayWeightLog?.weight;
  const previousWeight = weights.find(w => w.date < todayStr)?.weight;
  const weightDiff = latestWeight && previousWeight ? (latestWeight - previousWeight).toFixed(1) : null;

  // 距目标还差
  const goalDiff = useMemo(() => {
    if (weightGoal === null || latestWeight === undefined) return null;
    return Math.round((latestWeight - weightGoal) * 10) / 10;
  }, [weightGoal, latestWeight]);

  // 趋势洞察：近 7 天均值 vs 再前 7 天均值
  const trendInsight = useMemo(() => {
    if (weights.length < 2) return null;
    const sorted = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastTs = new Date(sorted[sorted.length - 1].date).getTime();
    const day = 86400000;
    const recent = sorted.filter(w => new Date(w.date).getTime() > lastTs - 7 * day);
    const prev = sorted.filter(w => {
      const t = new Date(w.date).getTime();
      return t <= lastTs - 7 * day && t > lastTs - 14 * day;
    });
    if (recent.length === 0 || prev.length === 0) return null;
    const avg = (arr: WeightLog[]) => arr.reduce((a, b) => a + b.weight, 0) / arr.length;
    const delta = Math.round((avg(recent) - avg(prev)) * 10) / 10;
    if (delta < -0.05) return { text: `稳步下降中，近7天均值比之前一周低 ${Math.abs(delta)}kg，继续保持`, good: true };
    if (delta > 0.05) return { text: `近7天均值比之前一周高 ${delta}kg，注意饮食与训练量`, good: false };
    return { text: '体重保持平稳，波动在正常范围内', good: true };
  }, [weights]);

  // 体重打卡日历：近 6 周（42 天）
  const weightCal = useMemo(() => {
    const days: { date: string; day: number; isToday: boolean; logged: boolean }[] = [];
    const dateSet = new Set(weights.map(w => w.date));
    for (let i = 41; i >= 0; i--) {
      const date = shiftLocalDate(todayStr, -i);
      days.push({
        date,
        day: Number(date.slice(8, 10)),
        isToday: i === 0,
        logged: dateSet.has(date),
      });
    }
    return days;
  }, [weights, todayStr]);

  // 时段过滤 + 打卡日历日期过滤后的体重列表
  const visibleWeights = useMemo(() => {
    return weights.filter(w => {
      if (slotFilter !== 'all' && (w.timeSlot || 'morning') !== slotFilter) return false;
      if (selectedWeightDate && w.date !== selectedWeightDate) return false;
      return true;
    });
  }, [weights, slotFilter, selectedWeightDate]);

  // 根据当前视图筛选体重数据并按日期升序排列供画曲线
  const filteredChartWeights = useMemo(() => {
    if (weights.length === 0) return [];
    const sorted = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (chartViewSpan === 'all') {
      return sorted;
    }

    // 周视图取近 7 天，月视图取近 30 天
    const daysLimit = chartViewSpan === 'week' ? 7 : 30;
    // 取最新记录的日期作为基准时间（防止历史预置日期距今天数过大导致过滤为空）
    const latestTimestamp = new Date(sorted[sorted.length - 1].date).getTime();
    const cutoffTime = latestTimestamp - (daysLimit - 1) * 24 * 60 * 60 * 1000;

    const inRange = sorted.filter(w => new Date(w.date).getTime() >= cutoffTime);
    if (inRange.length > 0) return inRange;
    return sorted.slice(-daysLimit);
  }, [weights, chartViewSpan]);

  // 计算区间曲线的统计指标（最高、最低、均值、波动差值）
  const chartStats = useMemo(() => {
    if (filteredChartWeights.length === 0) return null;
    const vals = filteredChartWeights.map(w => w.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    const netChange = (vals[vals.length - 1] - vals[0]).toFixed(1);
    return { min, max, avg, netChange: parseFloat(netChange) };
  }, [filteredChartWeights]);

  // 生成高保真 SVG 平滑贝塞尔曲线路径（含目标体重虚线）
  const svgData = useMemo(() => {
    const list = filteredChartWeights;
    const width = 360;
    const height = 150;
    const padL = 36;
    const padR = 24;
    const padT = 24;
    const padB = 26;

    if (list.length === 0) return null;

    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const vals = list.map(d => d.weight);
    let minVal = Math.min(...vals);
    let maxVal = Math.max(...vals);
    // 目标线纳入纵轴范围
    if (weightGoal !== null) {
      minVal = Math.min(minVal, weightGoal);
      maxVal = Math.max(maxVal, weightGoal);
    }
    if (maxVal === minVal) {
      minVal -= 1;
      maxVal += 1;
    } else {
      const margin = (maxVal - minVal) * 0.18;
      minVal -= margin;
      maxVal += margin;
    }
    const yOf = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    const points = list.map((item, idx) => {
      let x: number;
      if (list.length === 1) {
        x = padL + chartW / 2;
      } else if (chartViewSpan === 'month') {
        const startOffset = padL + chartW * 0.2;
        const availableW = chartW * 0.75;
        x = startOffset + (idx / (list.length - 1)) * availableW;
      } else {
        x = padL + (idx / (list.length - 1)) * chartW;
      }
      return { x, y: yOf(item.weight), weight: item.weight, date: item.date.slice(5) };
    });

    const goalY = weightGoal !== null ? yOf(weightGoal) : null;

    if (points.length === 1) {
      const p = points[0];
      return {
        width, height, points, goalY,
        linePath: `M ${padL} ${p.y} L ${width - padR} ${p.y}`,
        areaPath: `M ${padL} ${p.y} L ${width - padR} ${p.y} L ${width - padR} ${height - padB} L ${padL} ${height - padB} Z`,
        midVal: ((minVal + maxVal) / 2).toFixed(1),
        minVal: minVal.toFixed(1),
        maxVal: maxVal.toFixed(1),
      };
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = (p1.x - p0.x) * (chartViewSpan === 'month' ? 0.35 : 0.45);
      const cp1x = p0.x + dx;
      const cp1y = p0.y;
      const cp2x = p1.x - dx;
      const cp2y = p1.y;
      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    const lastP = points[points.length - 1];
    const firstP = points[0];
    const areaPath = `${linePath} L ${lastP.x} ${height - padB} L ${firstP.x} ${height - padB} Z`;

    return {
      width, height, points, goalY,
      linePath, areaPath,
      midVal: ((minVal + maxVal) / 2).toFixed(1),
      minVal: minVal.toFixed(1),
      maxVal: maxVal.toFixed(1),
    };
  }, [filteredChartWeights, chartViewSpan, weightGoal]);

  // 日历格子：规范 5.11 —— 不用状态圆点，直接给日期数字着色；
  // 今天用 1.5px accent 内描边标记，不覆盖状态色；网格保持中性。
  const calCellCls = 'flex h-11 items-center justify-center rounded-ctl transition-colors';
  const calDayCls = 'flex h-8 w-8 items-center justify-center rounded-full text-sm2 font-semibold tabular-nums';

  // 日历格子渲染（训练活动）
  const renderActivityCal = () => (
    <Card className="p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-h2 font-semibold text-ink">
          <CalendarDays className="h-4 w-4 text-ink-3" aria-hidden="true" /> 近8周活动
        </span>
        <div className="flex items-center gap-2 text-cap text-ink-3">
          <span className="font-semibold text-success">训练</span>
          <span className="font-semibold text-warning">休息</span>
          <span>未记录</span>
          {selectedCalDate && (
            <button
              type="button"
              onClick={() => setSelectedCalDate(null)}
              className="h-11 px-1 font-semibold text-accent underline"
            >
              清除{selectedCalDate.slice(5)}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-cap font-medium text-ink-3">{w}</div>
        ))}
        {/* 首格按星期补齐 */}
        {Array.from({ length: weekdayOf(activityCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {activityCal.map(d => {
          const future = d.date > todayStr;
          const stateText = d.hasTraining ? '训练' : d.hasRest ? '休息' : future ? '未到日期' : '未记录';
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedCalDate(prev => (prev === d.date ? null : d.date))}
              aria-pressed={selectedCalDate === d.date}
              aria-label={`${d.date} ${stateText}`}
              className={cx(calCellCls, selectedCalDate === d.date ? 'bg-surface-subtle' : 'hover:bg-surface-subtle/60')}
            >
              <span
                className={cx(
                  calDayCls,
                  d.hasTraining
                    ? 'text-success'
                    : d.hasRest
                      ? 'text-warning'
                      : future
                        ? 'text-ink-disabled'
                        : 'text-ink-3',
                  d.isToday && 'ring-[1.5px] ring-inset ring-accent',
                )}
              >
                {d.day}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  // 体重打卡日历
  const renderWeightCal = () => (
    <Card className="p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-h2 font-semibold text-ink">
          <CalendarDays className="h-4 w-4 text-ink-3" aria-hidden="true" /> 近6周打卡
        </span>
        <div className="flex items-center gap-2 text-cap text-ink-3">
          <span className="font-semibold text-success">已打卡</span>
          <span>未记录</span>
          {selectedWeightDate && (
            <button
              type="button"
              onClick={() => setSelectedWeightDate(null)}
              className="h-11 px-1 font-semibold text-accent underline"
            >
              清除{selectedWeightDate.slice(5)}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-cap font-medium text-ink-3">{w}</div>
        ))}
        {Array.from({ length: weekdayOf(weightCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`wpad-${i}`} />
        ))}
        {weightCal.map(d => {
          const future = d.date > todayStr;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelectedWeightDate(prev => (prev === d.date ? null : d.date))}
              aria-pressed={selectedWeightDate === d.date}
              aria-label={`${d.date} ${d.logged ? '已打卡' : future ? '未到日期' : '未记录'}`}
              className={cx(calCellCls, selectedWeightDate === d.date ? 'bg-surface-subtle' : 'hover:bg-surface-subtle/60')}
            >
              <span
                className={cx(
                  calDayCls,
                  d.logged ? 'text-success' : future ? 'text-ink-disabled' : 'text-ink-3',
                  d.isToday && 'ring-[1.5px] ring-inset ring-accent',
                )}
              >
                {d.day}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4 pb-24 pt-2">
      {/* 头部标题与双标签切换 */}
      <div>
        <div className="flex items-center justify-between text-cap font-semibold tracking-[0.04em] text-ink-3">
          <span>FITCUSTOM PRO</span>
          <span>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            {' '}
            {new Date().toLocaleDateString('zh-CN', { weekday: 'short' })}
          </span>
        </div>
        <h1 className="mt-0.5 text-h1 font-bold tracking-tight text-ink">训练与生活日志</h1>
        <p className="mt-1 text-sm2 text-ink-2">历史打卡归档、日常体重走势与身体状态记录</p>
      </div>

      {/* 顶部子标签分段控制器 */}
      <SegmentedControl
        label="日志类型"
        value={activeSubTab}
        onChange={setActiveSubTab}
        options={[
          { value: 'training', label: `历史训练记录 (${sessions.length} 次)` },
          { value: 'weight', label: `体重与生活日志 (${weights.length} 条)` },
        ]}
      />

      {/* 提示消息浮层 */}
      {importStatus && (
        <div className="flex items-center gap-2 rounded-ctl border border-line bg-success-soft px-3 py-2.5 text-sm2 text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* ===================== TAB 1: 历史训练记录 ===================== */}
      {activeSubTab === 'training' && (
        <div className="space-y-3">
          {/* 统计条 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '累计训练', value: `${historyStats.trainings}次` },
              { label: '本周训练', value: `${historyStats.weekTrainings}次` },
              { label: '连续打卡', value: `${historyStats.streak}天` },
              { label: '总完成组', value: `${historyStats.totalSets}组` },
            ].map(s => (
              <Card key={s.label} className="min-w-0 p-2.5 text-center">
                <span className="block truncate text-cap text-ink-3">{s.label}</span>
                <NumberText size="md" className="mt-0.5 block truncate text-ink">{s.value}</NumberText>
              </Card>
            ))}
          </div>

          {renderActivityCal()}

          {/* 筛选 + 展开控制 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              label="历史记录类型"
              className="min-w-0 flex-1"
              value={historyFilter}
              onChange={setHistoryFilter}
              options={HISTORY_FILTER_OPTIONS}
            />
            {visibleSessions.length > 0 && (
              <button
                type="button"
                onClick={() => toggleAllSessions(visibleSessions.map(s => s.id))}
                className="flex h-11 items-center gap-1 px-2 text-sm2 font-semibold text-accent"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                {visibleSessions.every(s => expandedSessionIds.has(s.id)) ? '全部收起' : '全部展开'}
              </button>
            )}
          </div>

          {visibleSessions.length === 0 ? (
            <Card className="px-4 py-12 text-center">
              <p className="text-body text-ink-2">
                {sessions.length === 0
                  ? '暂无历史训练记录，去“今日训练”开启第一次打卡吧！'
                  : '当前筛选下没有记录，换个条件试试'}
              </p>
            </Card>
          ) : (
            visibleSessions.map((sess) => {
              // 专属渲染：纯粹的完全休息日卡片
              if (sess.isRestDay) {
                return (
                  <Card key={sess.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                        <Coffee className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-body font-semibold text-ink">休息日 (完全休息)</span>
                        <Badge>{sess.date}</Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center">
                      <IconButton label="编辑休息日备注" onClick={() => startEditSession(sess)}>
                        <Pencil className="h-[18px] w-[18px]" />
                      </IconButton>
                      <IconButton
                        label="删除此条记录"
                        tone="danger"
                        onClick={() => promptDeleteSession(sess.id, sess.planName, sess.date)}
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </IconButton>
                    </div>
                  </Card>
                );
              }

              const isExpanded = expandedSessionIds.has(sess.id);
              const totalCompletedSets = sess.exercises.reduce(
                (sum, e) => sum + e.sets.filter(s => s.completed).length, 0
              );
              const vols = sessionVolumes(sess);
              const volStr = formatVolumeShort(vols.kg, vols.plates);
              const durMin = sessionDurationMin(sess);

              return (
                <Card key={sess.id} className="overflow-hidden">
                  {/* 卡片头部：左侧文本区可点折叠/展开，右侧编辑/删除独立按钮 */}
                  <div className="flex items-start justify-between gap-2 p-3.5">
                    <button
                      type="button"
                      onClick={() => toggleExpandSession(sess.id)}
                      aria-expanded={isExpanded}
                      className="min-w-0 flex-1 select-none text-left"
                    >
                      <span className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-body font-semibold text-ink">{sess.planName}</span>
                        <Badge>{sess.date}</Badge>
                        {sess.cardioCompleted ? (
                          <Badge className="max-w-full">
                            <Flame className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              有氧{sess.cardioMinutes || 20}m{sess.cardioType ? ` · ${sess.cardioType}` : ''}
                            </span>
                          </Badge>
                        ) : (
                          <Badge className="text-ink-3">无有氧</Badge>
                        )}
                      </span>

                      {/* 折叠态摘要：容量 + 时长 + 动作列表 */}
                      <span className="block truncate text-sm2 text-ink-2">
                        共 {sess.exercises.length} 个动作 · {totalCompletedSets} 组完成
                        {volStr && <> · <span className="font-semibold text-ink">容量 {volStr}</span></>}
                        {durMin !== null && <> · 用时 {durMin}分钟</>}
                      </span>
                      <span className="mt-0.5 block truncate text-cap text-ink-3">
                        {sess.exercises.map(e => e.exerciseName).join('、')}
                      </span>
                    </button>

                    <span className="flex shrink-0 items-center gap-1">
                      <IconButton
                        label="编辑该条训练记录"
                        onClick={() => startEditSession(sess)}
                      >
                        <Pencil className="h-[18px] w-[18px]" />
                      </IconButton>
                      <IconButton
                        label="删除该条训练记录"
                        tone="danger"
                        onClick={() => promptDeleteSession(sess.id, sess.planName, sess.date)}
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </IconButton>
                      <button
                        type="button"
                        onClick={() => toggleExpandSession(sess.id)}
                        aria-label={isExpanded ? '收起该条训练明细' : '展开该条训练明细'}
                        aria-expanded={isExpanded}
                        className="flex h-11 w-11 items-center justify-center text-ink-3"
                      >
                        {isExpanded
                          ? <ChevronUp className="h-[18px] w-[18px]" aria-hidden="true" />
                          : <ChevronDown className="h-[18px] w-[18px]" aria-hidden="true" />}
                      </button>
                    </span>
                  </div>

                  {/* 展开内容区：具体动作与每组明细 */}
                  {isExpanded && (
                    <div className="animate-card-in space-y-2.5 border-t border-line px-3.5 pb-3.5 pt-3">
                      <div className="space-y-2">
                        {sess.exercises.map((e, idx) => {
                          const completedSets = e.sets.filter(s => s.completed);
                          const unitStr = e.currentUnit === 'plates' ? '片' : e.currentUnit === 'assisted' ? '助力' : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                          const pulleyStr = e.pulleyRatio && e.pulleyRatio !== 'none' ? e.pulleyRatio : null;

                          return (
                            <div key={idx} className="rounded-ctl border border-line bg-surface-subtle/50 p-2.5">
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <NumberText size="sm" className="shrink-0 text-ink-3">{idx + 1}.</NumberText>
                                  <span className="truncate text-body font-semibold text-ink">{e.exerciseName}</span>
                                  {pulleyStr && <Badge className="shrink-0">{pulleyStr}</Badge>}
                                </div>
                                <NumberText size="sm" className="shrink-0 text-ink-2">
                                  {completedSets.length} 组完成
                                </NumberText>
                              </div>

                              {/* 各组小标签 / 超级组大组阶梯流 */}
                              <div className="flex flex-wrap gap-1.5">
                                {completedSets.map((s, sIdx) => {
                                  if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
                                    return (
                                      <div
                                        key={sIdx}
                                        className="w-full space-y-1.5 rounded-ctl border border-line bg-surface p-2"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex items-center gap-1 text-sm2 font-semibold text-ink">
                                            <Flame className="h-3 w-3 text-ink-3" aria-hidden="true" />
                                            第 {s.setNumber} 大组 (超级组)
                                          </span>
                                          <Badge tone="success">{s.dropStages.length}阶递减全部完成</Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {s.dropStages.map((stg, stgIdx) => (
                                            <span
                                              key={stgIdx}
                                              className="inline-flex items-center gap-1 rounded-[6px] bg-surface-subtle px-2 py-0.5 text-sm2 tabular-nums text-ink"
                                            >
                                              {stg.weightOrPlates}{stg.unit || 'kg'} × {stg.reps}次
                                              {stgIdx < s.dropStages!.length - 1 && (
                                                <span className="text-ink-3" aria-hidden="true">→</span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <span
                                      key={sIdx}
                                      className="rounded-[6px] border border-line bg-surface px-2 py-0.5 text-sm2 tabular-nums text-ink-2"
                                    >
                                      {s.unilateral && s.left && s.right
                                        ? `左${s.left.weight}×${s.left.reps} / 右${s.right.weight}×${s.right.reps}${unitStr}`
                                        : `${s.weightOrPlates}${unitStr} × ${s.reps}次`}
                                    </span>
                                  );
                                })}
                              </div>

                              {e.notes && (
                                <p className="mt-1.5 text-cap italic text-ink-3">“{e.notes}”</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 有氧明细 */}
                      {sess.cardioCompleted && (
                        <div className="flex items-start gap-1.5 rounded-ctl bg-surface-subtle px-3 py-2 text-sm2 text-ink-2">
                          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                          <span>
                            有氧 {sess.cardioMinutes || 20} 分钟
                            {sess.cardioType ? ` · ${sess.cardioType}` : ''}
                            {sess.cardioNotes ? ` · ${sess.cardioNotes}` : ''}
                          </span>
                        </div>
                      )}

                      {/* 训练备注 */}
                      {sess.notes && (
                        <div className="flex items-start gap-1.5 rounded-ctl bg-surface-subtle px-3 py-2 text-sm2 text-ink-2">
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                          <span>{sess.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ===================== TAB 2: 体重与生活日志 ===================== */}
      {activeSubTab === 'weight' && (
        <div className="space-y-4">
          {/* 趋势洞察横幅 */}
          {trendInsight && (
            <div className={cx(
              'flex items-center gap-2 rounded-ctl border border-line px-3 py-2.5 text-sm2',
              trendInsight.good ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning',
            )}>
              <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-semibold">趋势洞察：{trendInsight.text}</span>
            </div>
          )}

          {/* 打卡今日体重与饮食卡片 */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Scale className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                <h3 className="truncate text-h2 font-semibold text-ink">打卡今日体重与饮食</h3>
              </div>
              {existingTodayLog && !isEditingExisting && (
                <button
                  type="button"
                  onClick={() => setIsEditingExisting(true)}
                  className="h-11 shrink-0 px-1 text-sm2 font-semibold text-accent"
                >
                  修改该日打卡
                </button>
              )}
            </div>

            {formError && (
              <p className="mb-2.5 rounded-ctl bg-danger-soft px-3 py-2 text-sm2 font-semibold text-danger">
                {formError}
              </p>
            )}

            <form onSubmit={handleAddLog} className="space-y-3">
              <div>
                <label htmlFor="weight-input" className="mb-1 block text-cap font-semibold text-ink-2">体重 (kg)</label>
                <div className="relative">
                  <input
                    id="weight-input"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={inputWeight}
                    disabled={isAlreadyLogged}
                    onChange={(e) => setInputWeight(e.target.value)}
                    className={cx(fieldCls, 'pr-10 tabular-nums disabled:opacity-60', isAlreadyLogged && 'bg-surface-subtle text-ink-3')}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm2 font-semibold text-ink-3">kg</span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-cap font-semibold text-ink-2">记录时段</p>
                <SegmentedControl
                  label="记录时段"
                  value={inputSlot}
                  onChange={setInputSlot}
                  options={SLOT_OPTIONS}
                  disabled={isAlreadyLogged}
                />
              </div>

              <div>
                <label htmlFor="weight-note" className="mb-1 block text-cap font-semibold text-ink-2">
                  饮食与生活日记 (饮食摄入、精神状态等)
                </label>
                <input
                  id="weight-note"
                  type="text"
                  value={inputNote}
                  disabled={isAlreadyLogged}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="例如: 晚上吃了鸡公煲，蛋白质充足；昨晚深蹲膝盖微酸..."
                  className={cx(fieldCls, 'disabled:opacity-60', isAlreadyLogged && 'bg-surface-subtle text-ink-3')}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <input
                  type="date"
                  aria-label="打卡日期"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="h-11 min-w-0 rounded-ctl border border-line bg-surface-subtle px-2.5 text-sm2 text-ink focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                />

                {isAlreadyLogged ? (
                  <Button variant="secondary" disabled>
                    <Check className="h-4 w-4" aria-hidden="true" /> 今日已打卡
                  </Button>
                ) : (
                  // 每日高频动作用 primary；备份导出在页面底部另一屏，同为 primary 不构成同屏冲突
                  <Button type="submit" variant="primary">
                    <Plus className="h-4 w-4" aria-hidden="true" /> 记录打卡
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* 体重看板：今日 / 变化 / 目标（今天未记录时保持空） */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="min-w-0 p-3">
              <span className="block truncate text-cap font-medium text-ink-3">今日体重</span>
              {latestWeight !== undefined ? (
                <div className="mt-1 flex items-baseline gap-1">
                  <NumberText size="lg" className="font-bold text-ink">{latestWeight}</NumberText>
                  <span className="text-sm2 text-ink-3">kg</span>
                </div>
              ) : (
                <div className="mt-2 text-body font-semibold text-ink-3">—</div>
              )}
            </Card>

            <Card className="min-w-0 p-3">
              <span className="block truncate text-cap font-medium text-ink-3">较上一次</span>
              <div className="mt-1.5 flex items-center gap-1.5">
                {weightDiff === null ? (
                  <span className="text-sm2 font-semibold text-ink-3">—</span>
                ) : parseFloat(weightDiff) > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-warning" aria-hidden="true" />
                    <NumberText size="sm" className="text-warning">+{weightDiff}</NumberText>
                  </>
                ) : parseFloat(weightDiff) < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-success" aria-hidden="true" />
                    <NumberText size="sm" className="text-success">{weightDiff}</NumberText>
                  </>
                ) : (
                  <span className="text-sm2 font-semibold text-ink-3">持平</span>
                )}
              </div>
            </Card>

            <Card className="min-w-0 p-3">
              <span className="flex items-center gap-1 text-cap font-medium text-ink-3">
                <Target className="h-3 w-3 shrink-0" aria-hidden="true" /> 目标体重
              </span>
              {weightGoal !== null ? (
                <div className="mt-1">
                  <span className="flex items-baseline gap-1">
                    <NumberText size="lg" className="font-bold text-ink">{weightGoal}</NumberText>
                    <span className="text-sm2 text-ink-3">kg</span>
                  </span>
                  {goalDiff !== null && (
                    <span className={cx(
                      'mt-0.5 block text-cap font-semibold',
                      goalDiff > 0 ? 'text-warning' : goalDiff < 0 ? 'text-success' : 'text-ink-3',
                    )}>
                      {goalDiff > 0 ? `还差 ${goalDiff}kg` : goalDiff < 0 ? `已超目标 ${Math.abs(goalDiff)}kg` : '已达标'}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setGoalInput(''); setShowGoalEditor(true); }}
                  className="mt-1 h-11 text-sm2 font-semibold text-accent underline"
                >
                  设定目标
                </button>
              )}
            </Card>
          </div>

          {/* 目标编辑行（竖排：输入一行 + 按钮一行，杜绝小屏横向溢出） */}
          {showGoalEditor && (
            <Card className="animate-card-in space-y-2 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  aria-label="目标体重"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder={weightGoal !== null ? `当前 ${weightGoal}` : '例如 65'}
                  className={cx(fieldCls, 'min-w-0 flex-1 tabular-nums')}
                />
                <span className="shrink-0 text-sm2 text-ink-2">kg</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => setShowGoalEditor(false)}>
                  取消
                </Button>
                <Button variant="outline" onClick={handleSaveGoal}>
                  保存目标
                </Button>
              </div>
            </Card>
          )}
          {weightGoal !== null && !showGoalEditor && (
            <div className="-mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => { setGoalInput(String(weightGoal)); setShowGoalEditor(true); }}
                className="h-11 px-1 text-sm2 text-ink-3 underline"
              >
                修改目标
              </button>
            </div>
          )}

          {/* 体重波动曲线图 */}
          <Card className="space-y-3 p-4">
            {/* 顶栏：标题与视图切换按钮 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-h2 font-semibold text-ink">
                  <TrendingDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" /> 体重波动曲线
                </span>
                <span className="text-cap text-ink-3">平滑贝塞尔走势{weightGoal !== null ? ' · 蓝色虚线为目标' : ''}</span>
              </div>

              {/* 周期切换: 周视图 / 月视图 / 全部 */}
              <SegmentedControl
                label="曲线周期"
                className="w-[168px] shrink-0"
                value={chartViewSpan}
                onChange={setChartViewSpan}
                options={CHART_SPAN_OPTIONS}
              />
            </div>

            {/* 动态视图说明横幅 */}
            <div className="flex items-center justify-between gap-2 rounded-ctl bg-surface-subtle px-3 py-2 text-sm2 text-ink-2">
              <span>
                {chartViewSpan === 'week' && '周视图：近7日走势'}
                {chartViewSpan === 'month' && '月视图：过去30天走势'}
                {chartViewSpan === 'all' && '全部历史：全周期累计数据'}
              </span>
              <NumberText size="sm" className="shrink-0 text-ink-3">
                {filteredChartWeights.length} 条
              </NumberText>
            </div>

            {/* 区间统计指标指示条 */}
            {chartStats && (
              <div className="grid grid-cols-4 gap-1.5 rounded-ctl border border-line bg-surface-subtle/60 px-2.5 py-2 text-center">
                <div>
                  <span className="block text-cap text-ink-3">最低</span>
                  <NumberText size="sm" className="text-ink">{chartStats.min}kg</NumberText>
                </div>
                <div>
                  <span className="block text-cap text-ink-3">最高</span>
                  <NumberText size="sm" className="text-ink">{chartStats.max}kg</NumberText>
                </div>
                <div>
                  <span className="block text-cap text-ink-3">平均</span>
                  <NumberText size="sm" className="text-ink">{chartStats.avg}kg</NumberText>
                </div>
                <div>
                  <span className="block text-cap text-ink-3">净变</span>
                  <NumberText
                    size="sm"
                    className={chartStats.netChange > 0 ? 'text-warning' : chartStats.netChange < 0 ? 'text-success' : 'text-ink-2'}
                  >
                    {chartStats.netChange > 0 ? `+${chartStats.netChange}` : chartStats.netChange}kg
                  </NumberText>
                </div>
              </div>
            )}

            {/* SVG 矢量平滑折线走势图 */}
            {svgData && svgData.points.length > 0 ? (
              <div className="w-full overflow-hidden pt-1">
                <svg
                  viewBox={`0 0 ${svgData.width} ${svgData.height}`}
                  className="h-36 w-full select-none"
                  role="img"
                  aria-label={`体重走势，共 ${svgData.points.length} 个记录点`}
                >
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--c-success))" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="rgb(var(--c-success))" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* 背景参考横虚线 */}
                  <line x1="36" y1="30" x2="336" y2="30" stroke="rgb(var(--c-line))" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="75" x2="336" y2="75" stroke="rgb(var(--c-line))" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="120" x2="336" y2="120" stroke="rgb(var(--c-line))" strokeDasharray="3 3" strokeWidth="1" />

                  {/* 目标体重虚线 */}
                  {svgData.goalY !== null && weightGoal !== null && (
                    <g>
                      <line
                        x1="36" y1={svgData.goalY} x2="336" y2={svgData.goalY}
                        stroke="rgb(var(--c-accent))" strokeDasharray="5 4" strokeWidth="1.5"
                      />
                      <text
                        x="336" y={svgData.goalY - 5}
                        textAnchor="end" fontSize="12" fontWeight="600"
                        fill="rgb(var(--c-accent))"
                      >
                        目标 {weightGoal}
                      </text>
                    </g>
                  )}

                  {/* 面积渐变填充 */}
                  <path d={svgData.areaPath} fill="url(#weightGradient)" />

                  {/* 平滑贝塞尔曲线 */}
                  <path
                    d={svgData.linePath}
                    fill="none"
                    stroke="rgb(var(--c-success))"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* 节点高亮圆点与文字标注 */}
                  {svgData.points.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="5" fill="rgb(var(--c-success))" fillOpacity="0.15" />
                      <circle cx={p.x} cy={p.y} r="3" fill="rgb(var(--c-success))" stroke="rgb(var(--c-surface))" strokeWidth="1.5" />
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="600"
                        fill="rgb(var(--c-ink))"
                      >
                        {p.weight}
                      </text>
                      <text
                        x={p.x}
                        y={svgData.height - 8}
                        textAnchor="middle"
                        fontSize="12"
                        fill="rgb(var(--c-ink-3))"
                      >
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="rounded-ctl bg-surface-subtle px-4 py-8 text-center text-body text-ink-2">
                该周期内暂无体重数据
              </div>
            )}
          </Card>

          {renderWeightCal()}

          {/* 历史打卡日志列表 */}
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="shrink-0 text-h2 font-semibold text-ink">体重与日记记录</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <SegmentedControl
                  label="记录时段筛选"
                  className="w-[248px] max-w-full"
                  value={slotFilter}
                  onChange={setSlotFilter}
                  options={SLOT_FILTER_OPTIONS}
                />
                <span className="text-sm2 text-ink-3">共 {visibleWeights.length} 条</span>
              </div>
            </div>

            <div className="space-y-2">
              {visibleWeights.map((log) => (
                <Card key={log.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <NumberText size="md" className="text-ink">{log.weight} kg</NumberText>
                      <button
                        type="button"
                        onClick={() => setSlotFilter(log.timeSlot || 'morning')}
                        className="h-11 rounded-full bg-surface-subtle px-3 text-cap font-semibold text-ink-2"
                        title="按此时段过滤"
                      >
                        {SLOT_SHORT[log.timeSlot || 'morning']}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputDate(log.date)}
                        className="h-11 px-2 text-sm2 font-medium text-ink-3 underline"
                        title="跳到该日期打卡"
                      >
                        {log.date}
                      </button>
                    </div>

                    {log.note && (
                      <div className="flex items-start gap-1.5 rounded-ctl bg-surface-subtle px-2.5 py-1.5 text-sm2 text-ink-2">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                        <span>{log.note}</span>
                      </div>
                    )}
                  </div>

                  <IconButton
                    label="删除此条体重记录"
                    tone="danger"
                    onClick={() => promptDeleteWeight(log.id, log.date, log.weight)}
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </IconButton>
                </Card>
              ))}
              {visibleWeights.length === 0 && (
                <Card className="px-4 py-8 text-center">
                  <p className="text-body text-ink-2">当前筛选下没有记录</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 数据安全与备份中心 */}
      <Card className="p-4">
        <h3 className="mb-2 text-h2 font-semibold text-ink">本地数据中心与备份</h3>
        <p className="mb-3 text-sm2 leading-relaxed text-ink-2">
          所有计划、训练动作与体重日记 100% 保存在本地。可随时导出 JSON 备份，或导入备份文件恢复数据。
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="primary" onClick={handleExportBackup}>
            <Download className="h-4 w-4" aria-hidden="true" /> 导出 JSON 备份
          </Button>

          <Button
            variant="secondary"
            onClick={() => document.getElementById('journal-import-file')?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden="true" /> 导入恢复备份
          </Button>
          <input
            id="journal-import-file"
            type="file"
            accept=".json"
            aria-label="导入恢复备份"
            onChange={handleImportBackup}
            className="hidden"
          />
        </div>

        {backupStatus && (
          <div
            className={cx(
              'mt-2 flex items-start gap-1.5 rounded-ctl px-3 py-2 text-sm2 font-semibold',
              backupStatus.type === 'success'
                ? 'bg-success-soft text-success'
                : 'bg-danger-soft text-danger',
            )}
          >
            {backupStatus.type === 'success' ? (
              <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="break-all">{backupStatus.message}</span>
          </div>
        )}
      </Card>

      {/* 历史训练编辑弹窗（同 id 写回；休息日仅备注可改）
          规范 5.4 只允许一层 sheet：规格 / 换动作 / 新增动作弹层打开时先隐藏本层，
          关掉上层后自动回到编辑态（编辑草稿仍在 state 中）。 */}
      <Sheet
        open={editingSession !== null && editSpecExIdx === null && replaceExIdx === null && !addExOpen}
        onClose={cancelEditSession}
        title="编辑训练记录"
        description={editingSession ? `${editingSession.date}${editingSession.isRestDay ? ' · 休息日' : ''}` : undefined}
        size="lg"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={cancelEditSession}>
              取消
            </Button>
            <Button variant="primary" onClick={saveEditSession}>
              保存修改
            </Button>
          </div>
        }
      >
        {editingSession && (() => {
          return (
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-session-name" className="mb-1 block text-cap font-semibold text-ink-2">训练记录名称</label>
                <input
                  id="edit-session-name"
                  type="text"
                  value={editingSession.planName}
                  onChange={(e) => patchEditing(d => { d.planName = e.target.value; })}
                  placeholder="训练记录名称"
                  className={fieldCls}
                />
              </div>

              <div>
                <label htmlFor="edit-session-notes" className="mb-1 block text-cap font-semibold text-ink-2">训练备注</label>
                <textarea
                  id="edit-session-notes"
                  rows={2}
                  value={editingSession.notes || ''}
                  onChange={(e) => editSessionNotes(e.target.value)}
                  placeholder="记录当日状态、器械手感等..."
                  className="w-full rounded-ctl border border-line bg-surface-subtle p-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                />
              </div>

              {/* 有氧编辑：无有氧 / 有有氧 + 自定义时长、类型、备注 */}
              {!editingSession.isRestDay && (
                <div className="space-y-2.5 rounded-ctl border border-line bg-surface-subtle/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-body font-semibold text-ink">
                      <Flame className="h-4 w-4 text-ink-3" aria-hidden="true" /> 有氧
                    </span>
                    <span className="text-sm2 text-ink-3">
                      {editingSession.cardioCompleted ? '有有氧' : '无有氧'}
                    </span>
                  </div>
                  <SegmentedControl
                    label="有氧安排"
                    value={editingSession.cardioCompleted ? 'yes' : 'none'}
                    onChange={(value) => editCardioMode(value === 'yes')}
                    options={CARDIO_MODE_OPTIONS}
                  />
                  {editingSession.cardioCompleted && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="edit-cardio-minutes" className="mb-1 block text-cap font-semibold text-ink-2">时长（分钟）</label>
                          <input
                            id="edit-cardio-minutes"
                            type="number"
                            min={1}
                            max={300}
                            inputMode="numeric"
                            value={editingSession.cardioMinutes || ''}
                            onChange={(e) => editCardioMinutes(parseInt(e.target.value) || 0)}
                            className={cx(fieldCls, 'tabular-nums')}
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-cardio-type" className="mb-1 block text-cap font-semibold text-ink-2">类型</label>
                          <input
                            id="edit-cardio-type"
                            type="text"
                            value={editingSession.cardioType || ''}
                            onChange={(e) => editCardioType(e.target.value)}
                            placeholder="跑步机坡度快走"
                            className={fieldCls}
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        aria-label="有氧备注"
                        value={editingSession.cardioNotes || ''}
                        onChange={(e) => editCardioNotes(e.target.value)}
                        placeholder="有氧备注，例如坡度/速度/感受（可留空）"
                        className={fieldCls}
                      />
                    </>
                  )}
                </div>
              )}

              {!editingSession.isRestDay && editingSession.exercises.map((e, exIdx) => {
                const unitStr = e.currentUnit === 'plates' ? '片'
                  : e.currentUnit === 'assisted' ? '助力'
                  : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                // 该动作是否已按超级组编排（任一组带超级组标记）
                const isDrop = e.sets.some(s => s.isDropSet);
                return (
                  <div key={exIdx} className="space-y-2 rounded-ctl border border-line bg-surface-subtle/60 p-3">
                    {/* 动作名：可直接改名（仅改本条记录） */}
                    <div>
                      <label htmlFor={`edit-ex-name-${exIdx}`} className="mb-1 block text-cap font-semibold text-ink-2">动作名称</label>
                      <input
                        id={`edit-ex-name-${exIdx}`}
                        type="text"
                        value={e.exerciseName}
                        onChange={(ev) => editExerciseName(exIdx, ev.target.value)}
                        className={cx(fieldCls, 'font-semibold')}
                      />
                    </div>

                    {/* 规格胶囊：展示当前计量单位与滑轮，点击打开规格抽屉 */}
                    <button
                      type="button"
                      onClick={() => setEditSpecExIdx(exIdx)}
                      className="flex h-11 w-full items-center gap-2 rounded-ctl border border-line bg-surface px-3 text-left transition-colors active:bg-surface-strong"
                    >
                      <Layers className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                      <span className="shrink-0 text-cap font-semibold text-ink-3">规格</span>
                      <span className="min-w-0 flex-1 truncate text-sm2 font-semibold text-ink-2">
                        {EDIT_UNIT_SHORT[e.currentUnit]} · {EDIT_PULLEY_SHORT[e.pulleyRatio]}{e.pulleyRatio !== 'none' ? ` (${e.pulleyRatio})` : ''}
                      </span>
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                    </button>

                    {/* 记录方式与超级组标记 + 操作 */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!isDrop && (
                        <Badge tone={e.isUnilateral ? 'accent' : 'neutral'}>
                          {e.isUnilateral ? '左右独立' : '双侧'}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => editToggleUnilateral(exIdx, !e.isUnilateral)}
                        className="h-11 px-1 text-sm2 font-semibold text-accent underline"
                      >
                        {e.isUnilateral ? '切回双侧' : '改为单侧'}
                      </button>
                      {isDrop && <Badge><Flame className="h-3 w-3" aria-hidden="true" />超级组</Badge>}
                      <button
                        type="button"
                        onClick={() => editToggleDropSet(exIdx, !isDrop)}
                        className="h-11 px-1 text-sm2 font-semibold text-accent underline"
                      >
                        {isDrop ? '取消超级组' : '设为超级组'}
                      </button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => { setReplaceExIdx(exIdx); setReplaceSearch(''); }}
                        className="h-11 px-1 text-sm2 font-semibold text-ink-2 underline"
                      >
                        换动作
                      </button>
                      {editingSession.exercises.length > 1 && (
                        <button
                          type="button"
                          onClick={() => editRemoveExercise(exIdx)}
                          className="h-11 px-1 text-sm2 text-ink-3 underline hover:text-danger"
                        >
                          删动作
                        </button>
                      )}
                    </div>

                    {/* 组行：普通 / 左右独立 / 超级组阶梯 */}
                    <div className="space-y-2">
                      {!isDrop && !e.isUnilateral && (
                        <div className="grid grid-cols-[32px_1fr_64px_44px] items-center gap-2 px-2 text-center text-cap font-semibold text-ink-3">
                          <span>组</span>
                          <span>{unitStr}</span>
                          <span>次</span>
                          <span />
                        </div>
                      )}
                      {!isDrop && e.isUnilateral && (
                        <div className="grid grid-cols-[26px_1fr_1px_1fr_44px] items-center gap-1.5 px-2 text-center text-cap font-semibold text-ink-3">
                          <span>组</span>
                          <span>左</span>
                          <span />
                          <span>右</span>
                          <span />
                        </div>
                      )}

                      {e.sets.map((s, setIdx) => {
                        if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
                          return (
                            <div key={setIdx} className="rounded-ctl border border-line bg-surface px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-sm2 font-semibold text-ink">
                                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-subtle text-cap font-semibold text-ink-3 tabular-nums">
                                    {s.setNumber}
                                  </span>
                                  第 {s.setNumber} 大组
                                </span>
                                <span className="flex items-center gap-1">
                                  <Badge tone="success">{s.dropStages.length}阶递减</Badge>
                                  <IconButton
                                    label={`删除第 ${s.setNumber} 大组`}
                                    onClick={() => editRemoveSet(exIdx, setIdx)}
                                    disabled={e.sets.length <= 1}
                                    className="hover:text-danger disabled:opacity-40"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </IconButton>
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {s.dropStages.map((stg, stgIdx) => (
                                  <span
                                    key={stgIdx}
                                    className="inline-flex items-center gap-1 rounded-[6px] bg-surface-subtle px-2 py-1 text-sm2 tabular-nums text-ink-2"
                                  >
                                    {stg.weightOrPlates}{stg.unit || 'kg'} × {stg.reps}次
                                    {stgIdx < s.dropStages!.length - 1 && (
                                      <span className="text-ink-3" aria-hidden="true">→</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (s.unilateral) {
                          const sideBlock = (side: 'left' | 'right') => {
                            const label = side === 'left' ? '左' : '右';
                            const sd: UnilateralSide = s[side] || { weight: s.weightOrPlates, reps: s.reps };
                            return (
                              <div className="flex min-w-0 items-center justify-center gap-0.5">
                                <div className="flex min-w-[44px] flex-col items-center">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    aria-label={`第 ${s.setNumber} 组${label}侧重量`}
                                    value={sd.weight || ''}
                                    onChange={(ev) => editUnilateralField(exIdx, setIdx, side, 'weight', parseFloat(ev.target.value) || 0)}
                                    className="w-11 bg-transparent text-center text-[16px] font-semibold tabular-nums text-ink focus:outline-none"
                                  />
                                  <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-[6px] bg-surface-subtle px-1 py-0.5">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      aria-label={`第 ${s.setNumber} 组${label}侧次数`}
                                      value={sd.reps || ''}
                                      onChange={(ev) => editUnilateralField(exIdx, setIdx, side, 'reps', parseInt(ev.target.value) || 0)}
                                      className="w-6 bg-transparent text-center text-cap font-medium tabular-nums text-ink-3 focus:outline-none"
                                    />
                                    <span className="text-cap font-medium text-ink-3">次</span>
                                  </span>
                                </div>
                              </div>
                            );
                          };
                          return (
                            <div
                              key={setIdx}
                              className="grid min-h-[58px] grid-cols-[26px_1fr_1px_1fr_44px] items-center gap-1.5 rounded-ctl border border-line bg-surface px-2"
                            >
                              <span className="flex h-[26px] w-[26px] items-center justify-center justify-self-center rounded-[8px] bg-success-soft text-sm2 font-semibold tabular-nums text-success">
                                {s.setNumber}
                              </span>
                              {sideBlock('left')}
                              <span aria-hidden="true" className="h-7 w-px justify-self-center bg-line" />
                              {sideBlock('right')}
                              <IconButton
                                label={`删除第 ${s.setNumber} 组`}
                                onClick={() => editRemoveSet(exIdx, setIdx)}
                                disabled={e.sets.length <= 1}
                                className="justify-self-center hover:text-danger disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={setIdx}
                            className="grid h-14 grid-cols-[32px_1fr_64px_44px] items-center gap-2 rounded-ctl border border-line bg-surface px-2"
                          >
                            <span className="flex h-7 w-7 items-center justify-center justify-self-center rounded-[8px] bg-success-soft text-sm2 font-semibold tabular-nums text-success">
                              {s.setNumber}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              aria-label={`第 ${s.setNumber} 组重量`}
                              value={s.weightOrPlates || ''}
                              onChange={(ev) => editSetField(exIdx, setIdx, 'weightOrPlates', parseFloat(ev.target.value) || 0)}
                              className="mx-auto w-[52px] bg-transparent text-center text-[20px] font-semibold tabular-nums text-ink focus:outline-none"
                            />
                            <input
                              type="number"
                              inputMode="numeric"
                              aria-label={`第 ${s.setNumber} 组次数`}
                              value={s.reps || ''}
                              onChange={(ev) => editSetField(exIdx, setIdx, 'reps', parseInt(ev.target.value) || 0)}
                              className="h-11 w-full rounded-[8px] bg-surface-subtle text-center text-[17px] font-semibold tabular-nums text-ink focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                            <IconButton
                              label={`删除第 ${s.setNumber} 组`}
                              onClick={() => editRemoveSet(exIdx, setIdx)}
                              disabled={e.sets.length <= 1}
                              className="justify-self-center hover:text-danger disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => editAddSet(exIdx)}
                        className="flex h-11 w-full items-center justify-center gap-1 rounded-ctl border border-dashed border-line-strong text-sm2 font-semibold text-accent"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" /> 加一组
                      </button>
                    </div>

                    <div>
                      <label htmlFor={`edit-ex-notes-${exIdx}`} className="mb-1 block text-cap font-semibold text-ink-2">动作备注</label>
                      <input
                        id={`edit-ex-notes-${exIdx}`}
                        type="text"
                        value={e.notes || ''}
                        onChange={(ev) => editExerciseNotes(exIdx, ev.target.value)}
                        placeholder="该动作备注（可留空）"
                        className={fieldCls}
                      />
                    </div>
                  </div>
                );
              })}

              {!editingSession.isRestDay && (
                <button
                  type="button"
                  onClick={() => { setAddExOpen(true); setAddExSearch(''); }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line-strong text-body font-medium text-ink-2 hover:bg-surface-subtle"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> 新增动作
                </button>
              )}
            </div>
          );
        })()}
      </Sheet>

      {/* 历史编辑：规格抽屉（单位 + 滑轮），镜像开练页规格抽屉 */}
      <Sheet
        open={editingSession !== null && editSpecExIdx !== null && Boolean(editingSession.exercises[editSpecExIdx])}
        onClose={() => setEditSpecExIdx(null)}
        title="动作规格"
        description={editingSession && editSpecExIdx !== null ? editingSession.exercises[editSpecExIdx]?.exerciseName : undefined}
        footer={
          <Button variant="primary" size="lg" block onClick={() => setEditSpecExIdx(null)}>
            完成
          </Button>
        }
      >
        {editingSession && editSpecExIdx !== null && editingSession.exercises[editSpecExIdx] && (() => {
          const specEx = editingSession.exercises[editSpecExIdx];
          return (
            <div>
              <p className="mb-1.5 text-cap font-semibold text-ink-3">计量单位</p>
              <SegmentedControl
                label="计量单位"
                value={specEx.currentUnit}
                onChange={(unit) => editChangeUnit(editSpecExIdx, unit)}
                options={EDIT_UNIT_OPTIONS}
              />

              <p className="mb-1.5 mt-4 text-cap font-semibold text-ink-3">滑轮比例</p>
              <SegmentedControl
                label="滑轮比例"
                value={specEx.pulleyRatio}
                onChange={(ratio) => editChangePulley(editSpecExIdx, ratio)}
                options={EDIT_PULLEY_OPTIONS}
              />

              <p className="mt-3 text-cap text-ink-3">修改后该动作所有组同步</p>
            </div>
          );
        })()}
      </Sheet>

      {/* 历史编辑：换动作 / 新增动作挑选弹窗 */}
      {editingSession && (replaceExIdx !== null || addExOpen) && (() => {
        const kw = (replaceExIdx !== null ? replaceSearch : addExSearch).toLowerCase();
        const pool = (allExercises && allExercises.length > 0 ? allExercises : StorageService.getExercises())
          .filter(e => !kw || e.name.toLowerCase().includes(kw));
        const close = () => { setReplaceExIdx(null); setAddExOpen(false); };
        const pick = (ex: Exercise) => {
          if (replaceExIdx !== null) {
            editReplaceExercise(replaceExIdx, {
              id: ex.id, name: ex.name, category: ex.category,
              defaultUnit: ex.defaultUnit, defaultPulley: ex.defaultPulley || 'none',
              isUnilateral: ex.isUnilateral,
              isDropSet: ex.isDropSet,
              dropStages: ex.dropStages,
            });
          } else {
            editAddExercise({
              id: ex.id, name: ex.name, category: ex.category,
              defaultUnit: ex.defaultUnit, defaultPulley: ex.defaultPulley || 'none',
              isUnilateral: ex.isUnilateral,
              isDropSet: ex.isDropSet,
              dropStages: ex.dropStages,
            });
          }
          close();
        };
        return (
          <Sheet
            open
            onClose={close}
            title={replaceExIdx !== null ? '更换动作' : '新增动作'}
            description={replaceExIdx !== null ? '替换后保留组数与备注' : '加入本条历史记录'}
            size="lg"
          >
            <input
              type="text"
              placeholder="搜索动作名称（如 卧推、深蹲、夹胸）..."
              aria-label="搜索动作"
              value={replaceExIdx !== null ? replaceSearch : addExSearch}
              onChange={(e) => replaceExIdx !== null ? setReplaceSearch(e.target.value) : setAddExSearch(e.target.value)}
              className={fieldCls}
            />

            {/* 自定义新动作：默认收起，点开才展开表单 */}
            <button
              type="button"
              onClick={() => { setShowHistoryCustomForm(v => !v); setHistoryCustomError(null); }}
              aria-expanded={showHistoryCustomForm}
              className="mt-3 flex h-11 w-full items-center gap-2 rounded-ctl border border-dashed border-line-strong px-3 text-left"
            >
              <Plus className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="shrink-0 text-sm2 font-semibold text-ink">自定义新动作</span>
              <span className="min-w-0 flex-1 truncate text-cap text-ink-3">动作库里没有？在这里直接新增</span>
              {showHistoryCustomForm
                ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />}
            </button>

            {showHistoryCustomForm && (
              <div className="mt-2 space-y-3 rounded-ctl border border-line bg-surface-subtle/60 p-3 animate-card-in">
                {historyCustomError && (
                  <p className="rounded-ctl bg-danger-soft px-3 py-2 text-cap font-semibold text-danger">{historyCustomError}</p>
                )}
                <div>
                  <label htmlFor="history-custom-name" className="mb-1 block text-cap font-semibold text-ink-2">动作名称 *</label>
                  <input
                    id="history-custom-name"
                    type="text"
                    value={historyCustomName}
                    onChange={(e) => setHistoryCustomName(e.target.value)}
                    placeholder="例如: 史密斯下斜推胸"
                    className={fieldCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="history-custom-category" className="mb-1 block text-cap font-semibold text-ink-2">目标肌肉群</label>
                    <select
                      id="history-custom-category"
                      value={historyCustomCategory}
                      onChange={(e) => setHistoryCustomCategory(e.target.value as MuscleCategory)}
                      className={fieldCls}
                    >
                      <option value="chest">胸部</option>
                      <option value="back">背部</option>
                      <option value="shoulder">肩部</option>
                      <option value="leg">腿部</option>
                      <option value="biceps">肱二头</option>
                      <option value="triceps">肱三头</option>
                      <option value="abs">腹部核心</option>
                      <option value="cardio">有氧训练</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="history-custom-unit" className="mb-1 block text-cap font-semibold text-ink-2">计量单位</label>
                    <select
                      id="history-custom-unit"
                      value={historyCustomUnit}
                      onChange={(e) => setHistoryCustomUnit(e.target.value as ResistanceUnit)}
                      className={fieldCls}
                    >
                      <option value="plates">插销 (片)</option>
                      <option value="kg">重量 (kg)</option>
                      <option value="assisted">助力 (kg)</option>
                      <option value="bodyweight">自重</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="history-custom-pulley" className="mb-1 block text-cap font-semibold text-ink-2">滑轮类型</label>
                  <select
                    id="history-custom-pulley"
                    value={historyCustomPulley}
                    onChange={(e) => setHistoryCustomPulley(e.target.value as PulleyRatio)}
                    className={fieldCls}
                  >
                    <option value="none">普通固定器械/自由重量</option>
                    <option value="1:1">单滑轮 1:1</option>
                    <option value="2:1">双滑轮 2:1</option>
                  </select>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-ctl border border-line bg-surface px-3">
                  <span className="min-w-0">
                    <span className="block text-sm2 font-semibold text-ink">左右独立动作（单侧）</span>
                    <span className="block text-cap text-ink-3">开启后左右分别记录</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={historyCustomUnilateral}
                    onChange={(e) => setHistoryCustomUnilateral(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => { setHistoryCustomName(''); setHistoryCustomNotes(''); setHistoryCustomUnilateral(false); setHistoryCustomError(null); }}
                  >
                    清空
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!historyCustomName.trim()) { setHistoryCustomError('请输入动作名称'); return; }
                      const created = StorageService.addCustomExercise({
                        name: historyCustomName.trim(),
                        category: historyCustomCategory,
                        defaultUnit: historyCustomUnit,
                        defaultPulley: historyCustomPulley,
                        isUnilateral: historyCustomUnilateral || undefined,
                        notes: historyCustomNotes.trim() || undefined,
                        isFavorite: true,
                      });
                      setHistoryCustomName('');
                      setHistoryCustomNotes('');
                      setHistoryCustomUnilateral(false);
                      setHistoryCustomError(null);
                      setShowHistoryCustomForm(false);
                      pick(created);
                    }}
                  >
                    保存并加入本记录
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-3">
              {pool.map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => pick(ex)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-line px-1 py-2 text-left last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-body font-semibold text-ink">{ex.name}</span>
                    {ex.isUnilateral && <Badge>单侧</Badge>}
                    {ex.isCustom && <Badge>自建</Badge>}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                </button>
              ))}
              {pool.length === 0 && (
                <p className="py-6 text-center text-body text-ink-2">没有匹配的动作，换个关键词试试</p>
              )}
            </div>
          </Sheet>
        );
      })()}

      {/* 统一确认抽屉 */}
      <ConfirmSheet
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        danger
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
};
