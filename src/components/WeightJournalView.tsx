import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, Plus, TrendingDown, TrendingUp,
  Trash2, Download, Upload, CheckCircle2, MessageSquare,
  Dumbbell, Flame, RotateCcw, Check, ChevronDown, ChevronUp,
  Layers, Coffee, Target, CalendarDays, Zap, Pencil
} from 'lucide-react';
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

interface WeightJournalViewProps {
  onDataChanged?: () => void;
  allExercises?: Exercise[];
}

const SLOT_SHORT: Record<string, string> = {
  'morning': '晨起',
  'evening': '晚间',
  'post-workout': '练后',
};

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
  const [inputWeight, setInputWeight] = useState('63.3');
  const [inputDate, setInputDate] = useState(() => todayLocalDate());
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  // 体重目标
  const [weightGoal, setWeightGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  // 时段过滤：all / morning / post-workout / evening
  const [slotFilter, setSlotFilter] = useState<string>('all');
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

  // 弹窗打开时锁住底层 body 滚动，彻底杜绝滚动穿透
  useLockBodyScroll(editingSession !== null || editSpecExIdx !== null || confirmState.open || showGoalEditor);

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
    // addSession 对同 id 做原地替换，因此编辑是覆盖写回而非新增
    StorageService.addSession(editingSession);
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
  const editToggleUnilateral = (exIdx: number, on: boolean) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      ex.isUnilateral = on || undefined;
      ex.sets.forEach(s => {
        if (s.isDropSet) return;
        if (on) {
          s.unilateral = true;
          if (!s.left) s.left = { weight: s.weightOrPlates, reps: s.reps };
          if (!s.right) s.right = { weight: s.weightOrPlates, reps: s.reps };
        } else {
          s.unilateral = undefined;
        }
      });
    });

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
  const editReplaceExercise = (exIdx: number, neo: { id: string; name: string; category: WorkoutSession['exercises'][number]['category']; defaultUnit: WorkoutSession['exercises'][number]['currentUnit']; defaultPulley: WorkoutSession['exercises'][number]['pulleyRatio']; isUnilateral?: boolean }) =>
    patchEditing(d => {
      const ex = d.exercises[exIdx];
      const n = ex.sets.length || 1;
      ex.exerciseId = neo.id;
      ex.exerciseName = neo.name;
      ex.category = neo.category;
      ex.currentUnit = neo.defaultUnit;
      ex.pulleyRatio = neo.defaultPulley;
      ex.isUnilateral = neo.isUnilateral || undefined;
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

  // 恢复内置官方数据 (10.06 - 10.09)
  const handleRestoreOfficialData = () => {
    setConfirmState({
      open: true,
      title: '恢复 10.06 - 10.09 真实记录',
      description: '确定重置并重新载入官方 10.06 - 10.09 四日完整真实训练与体重数据吗？',
      confirmText: '确认恢复',
      onConfirm: () => {
        StorageService.restoreOfficialData();
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
        setImportStatus('已恢复 10.06 - 10.09 官方真实记录！');
        setTimeout(() => setImportStatus(null), 3000);
      },
    });
  };

  // 导出 JSON 备份
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitcustom-backup-${todayLocalDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  const latestWeight = weights[0]?.weight;
  const previousWeight = weights[1]?.weight;
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

  // 日历格子渲染（训练活动）
  const renderActivityCal = () => (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-black text-slate-900 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> 近8周活动
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />训练</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />休息</span>
          {selectedCalDate && (
            <button
              type="button"
              onClick={() => setSelectedCalDate(null)}
              className="text-blue-600 font-bold underline"
            >
              清除{selectedCalDate.slice(5)}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-[10px] text-slate-300 font-bold">{w}</div>
        ))}
        {/* 首格按星期补齐 */}
        {Array.from({ length: weekdayOf(activityCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {activityCal.map(d => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedCalDate(prev => (prev === d.date ? null : d.date))}
            className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all active:scale-95 ${
              selectedCalDate === d.date
                ? 'ring-2 ring-blue-600 ring-offset-1'
                : ''
            } ${
              d.hasTraining
                ? 'bg-blue-500 text-white'
                : d.hasRest
                  ? 'bg-amber-300 text-amber-900'
                  : d.isToday
                    ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                    : 'bg-slate-100 text-slate-300'
            }`}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );

  // 体重打卡日历
  const renderWeightCal = () => (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-black text-slate-900 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-emerald-600" /> 近6周打卡
        </span>
        {selectedWeightDate && (
          <button
            type="button"
            onClick={() => setSelectedWeightDate(null)}
            className="text-[11px] text-emerald-600 font-bold underline"
          >
            清除{selectedWeightDate.slice(5)}
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-[10px] text-slate-300 font-bold">{w}</div>
        ))}
        {Array.from({ length: weekdayOf(weightCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`wpad-${i}`} />
        ))}
        {weightCal.map(d => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedWeightDate(prev => (prev === d.date ? null : d.date))}
            className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all active:scale-95 ${
              selectedWeightDate === d.date ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
            } ${
              d.logged
                ? 'bg-emerald-500 text-white'
                : d.isToday
                  ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-300'
            }`}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pb-24 pt-2 space-y-4">
      {/* 头部标题与双标签切换 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">训练与生活日志</h1>
        <p className="text-xs text-slate-500 mt-0.5">历史打卡归档、日常体重走势与身体状态记录</p>
      </div>

      {/* 顶部子标签分段控制器 */}
      <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner">
        <button
          onClick={() => setActiveSubTab('training')}
          className={`flex-1 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] ${
            activeSubTab === 'training'
              ? 'bg-white text-blue-700 font-black shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/50'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5" /> 历史训练记录 ({sessions.length}次)
        </button>

        <button
          onClick={() => setActiveSubTab('weight')}
          className={`flex-1 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] ${
            activeSubTab === 'weight'
              ? 'bg-white text-emerald-700 font-black shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/50'
          }`}
        >
          <Scale className="w-3.5 h-3.5" /> 体重与生活日志 ({weights.length}条)
        </button>
      </div>

      {/* 提示消息浮层 */}
      {importStatus && (
        <div className="p-2.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* ===================== TAB 1: 历史训练记录 ===================== */}
      {activeSubTab === 'training' && (
        <div className="space-y-3">
          {/* 统计条 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '累计训练', value: `${historyStats.trainings}次`, accent: 'text-blue-700' },
              { label: '本周训练', value: `${historyStats.weekTrainings}次`, accent: 'text-blue-700' },
              { label: '连续打卡', value: `${historyStats.streak}天`, accent: 'text-amber-600' },
              { label: '总完成组', value: `${historyStats.totalSets}组`, accent: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-2 text-center shadow-sm min-w-0">
                <span className="text-[10px] text-slate-400 block truncate">{s.label}</span>
                <span className={`text-xs font-black font-mono ${s.accent}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {renderActivityCal()}

          {/* 筛选 + 展开控制 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/60 text-[11px] font-bold">
              {([
                { key: 'all', label: '全部' },
                { key: 'training', label: '训练' },
                { key: 'rest', label: '休息' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    historyFilter === f.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {visibleSessions.length > 0 && (
              <button
                onClick={() => toggleAllSessions(visibleSessions.map(s => s.id))}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
              >
                <Layers className="w-3 h-3" />
                {visibleSessions.every(s => expandedSessionIds.has(s.id)) ? '全部收起' : '全部展开'}
              </button>
            )}
          </div>

          {visibleSessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
              {sessions.length === 0
                ? '暂无历史训练记录，去“今日训练”开启第一次打卡吧！'
                : '当前筛选下没有记录，换个条件试试'}
            </div>
          ) : (
            visibleSessions.map((sess) => {
              // 专属渲染：纯粹的完全休息日卡片
              if (sess.isRestDay) {
                return (
                  <div
                    key={sess.id}
                    className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-amber-950 text-sm">休息日 (完全休息)</span>
                        <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                          {sess.date}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditSession(sess)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-amber-100/60 transition-colors"
                        title="编辑休息日备注"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => promptDeleteSession(sess.id, sess.planName, sess.date)}
                        className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-amber-100/50 transition-colors"
                        title="删除此条记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
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
                <div
                  key={sess.id}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-sm transition-all overflow-hidden"
                >
                  {/* 可点击卡片头部（触发折叠/展开） */}
                  <div
                    onClick={() => toggleExpandSession(sess.id)}
                    className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-slate-900 text-sm">{sess.planName}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {sess.date}
                        </span>
                        {sess.cardioCompleted && (
                          <span className="text-[10px] text-pink-700 bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200 flex items-center gap-0.5 font-bold">
                            <Flame className="w-2.5 h-2.5" /> 有氧{sess.cardioMinutes || 20}m
                          </span>
                        )}
                        {!sess.cardioCompleted && sess.cardioMinutes === 0 && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                            腿日无有氧
                          </span>
                        )}
                      </div>

                      {/* 折叠态摘要：容量 + 时长 + 动作列表 */}
                      <p className="text-[11px] text-slate-500 truncate">
                        共 {sess.exercises.length} 个动作 · {totalCompletedSets} 组完成
                        {volStr && <> · <span className="font-bold text-slate-700">容量 {volStr}</span></>}
                        {durMin !== null && <> · 用时 {durMin}分钟</>}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {sess.exercises.map(e => e.exerciseName).join('、')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditSession(sess);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="编辑该条训练记录"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          promptDeleteSession(sess.id, sess.planName, sess.date);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="删除该条训练记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50/80 px-2 py-1 rounded-lg border border-blue-200/80">
                        <span>{isExpanded ? '收起' : '展开'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* 展开内容区：具体动作与每组明细 */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 bg-slate-50/40 space-y-2.5">
                      <div className="space-y-2 pt-2">
                        {sess.exercises.map((e, idx) => {
                          const completedSets = e.sets.filter(s => s.completed);
                          const unitStr = e.currentUnit === 'plates' ? '片' : e.currentUnit === 'assisted' ? '助力' : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                          const pulleyStr = e.pulleyRatio && e.pulleyRatio !== 'none' ? ` (${e.pulleyRatio})` : '';

                          return (
                            <div key={idx} className="bg-white rounded-xl p-2.5 border border-slate-200/80 text-xs shadow-2xs">
                              <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                                  <span className="text-slate-900">{e.exerciseName}</span>
                                  {pulleyStr && (
                                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200 font-normal">
                                      {e.pulleyRatio}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-blue-700 font-semibold font-mono">
                                  {completedSets.length} 组完成
                                </span>
                              </div>

                              {/* 各组小标签 / 超级组大组阶梯流 */}
                              <div className="flex flex-wrap gap-1.5">
                                {completedSets.map((s, sIdx) => {
                                  if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
                                    return (
                                      <div
                                        key={sIdx}
                                        className="w-full bg-slate-50/90 p-2 rounded-xl border border-slate-200/90 text-[11px] font-mono space-y-1.5"
                                      >
                                        <div className="font-bold text-slate-800 flex items-center justify-between">
                                          <span className="text-blue-700 font-sans font-black">第 {s.setNumber} 大组 (递减超级组)</span>
                                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-sans font-semibold">
                                            {s.dropStages.length}阶递减全部完成
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-slate-800">
                                          {s.dropStages.map((stg, stgIdx) => (
                                            <span key={stgIdx} className="bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 font-bold shadow-2xs">
                                              {stg.weightOrPlates}{stg.unit || 'kg'} × {stg.reps}次
                                              {stgIdx < s.dropStages!.length - 1 && <span className="text-slate-300 ml-1">➔</span>}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <span
                                      key={sIdx}
                                      className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 font-medium"
                                    >
                                      {s.unilateral && s.left && s.right
                                        ? `左${s.left.weight}×${s.left.reps} / 右${s.right.weight}×${s.right.reps}${unitStr}`
                                        : `${s.weightOrPlates}${unitStr} × ${s.reps}次`}
                                    </span>
                                  );
                                })}
                              </div>

                              {e.notes && (
                                <p className="mt-1.5 text-[10px] text-slate-400 italic">“{e.notes}”</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 训练备注 */}
                      {sess.notes && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-1.5 text-xs text-blue-900">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>{sess.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
            <div className={`p-2.5 text-xs border rounded-xl flex items-center gap-2 ${
              trendInsight.good
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <Zap className="w-4 h-4 shrink-0" />
              <span className="font-bold">趋势洞察：{trendInsight.text}</span>
            </div>
          )}

          {/* 打卡今日体重与饮食卡片 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">打卡今日体重与饮食</h3>
              </div>
              {existingTodayLog && !isEditingExisting && (
                <button
                  type="button"
                  onClick={() => setIsEditingExisting(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
                >
                  修改该日打卡
                </button>
              )}
            </div>

            {formError && (
              <p className="mb-2.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                {formError}
              </p>
            )}

            <form onSubmit={handleAddLog} className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-[11px] text-slate-500 block mb-1">体重 (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={inputWeight}
                      disabled={isAlreadyLogged}
                      onChange={(e) => setInputWeight(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-base font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 ${
                        isAlreadyLogged ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                  </div>
                </div>

                <div className="col-span-7">
                  <label className="text-[11px] text-slate-500 block mb-1">记录时段</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { key: 'morning', label: '晨起空腹' },
                      { key: 'post-workout', label: '练后即刻' },
                      { key: 'evening', label: '晚间睡前' },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={isAlreadyLogged}
                        onClick={() => setInputSlot(s.key as 'morning' | 'evening' | 'post-workout')}
                        className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                          inputSlot === s.key
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : isAlreadyLogged
                            ? 'bg-slate-100 text-slate-300 border border-slate-200'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">饮食与生活日记 (饮食摄入、精神状态等)</label>
                <input
                  type="text"
                  value={inputNote}
                  disabled={isAlreadyLogged}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="例如: 晚上吃了鸡公煲，蛋白质充足；昨晚深蹲膝盖微酸..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 ${
                    isAlreadyLogged ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium"
                />

                {isAlreadyLogged ? (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold cursor-not-allowed flex items-center gap-1.5 transition-all"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> 今日已打卡
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> 记录打卡
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 体重看板：最新 / 变化 / 目标 */}
          {latestWeight && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">当前最新</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">{latestWeight}</span>
                  <span className="text-xs text-slate-400">kg</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">较上一次</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {weightDiff && parseFloat(weightDiff) > 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <span className="text-base font-bold text-amber-600">+{weightDiff}</span>
                    </>
                  ) : weightDiff && parseFloat(weightDiff) < 0 ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span className="text-base font-bold text-emerald-600">{weightDiff}</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">持平</span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Target className="w-3 h-3 text-blue-600" /> 目标体重
                </span>
                {weightGoal !== null ? (
                  <div className="mt-1">
                    <span className="text-2xl font-black text-blue-700 font-mono">{weightGoal}</span>
                    <span className="text-xs text-slate-400">kg</span>
                    {goalDiff !== null && (
                      <div className={`text-[10px] font-bold mt-0.5 ${goalDiff > 0 ? 'text-amber-600' : goalDiff < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {goalDiff > 0 ? `还差 ${goalDiff}kg` : goalDiff < 0 ? `已超目标 ${Math.abs(goalDiff)}kg 🎉` : '已达标 🎉'}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setGoalInput(''); setShowGoalEditor(true); }}
                    className="mt-1.5 text-xs text-blue-600 font-bold underline"
                  >
                    设定目标
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 目标编辑行（竖排：输入一行 + 按钮一行，杜绝小屏横向溢出） */}
          {showGoalEditor && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-2 animate-card-in">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder={weightGoal !== null ? `当前 ${weightGoal}` : '例如 65'}
                  className="flex-1 min-w-0 bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 shrink-0">kg</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalEditor(false)}
                  className="py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95"
                >
                  保存目标
                </button>
              </div>
            </div>
          )}
          {weightGoal !== null && !showGoalEditor && (
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => { setGoalInput(String(weightGoal)); setShowGoalEditor(true); }}
                className="text-[11px] text-slate-400 hover:text-blue-600 underline"
              >
                修改目标
              </button>
            </div>
          )}

          {/* 体重波动曲线图 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
            {/* 顶栏：标题与视图切换按钮 */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> 体重波动曲线
                </span>
                <span className="text-[10px] text-slate-400">平滑贝塞尔走势{weightGoal !== null ? ' · 蓝色虚线为目标' : ''}</span>
              </div>

              {/* 周期切换: 周视图 / 月视图 / 全部 */}
              <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center border border-slate-300/80 text-[11px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setChartViewSpan('week')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'week'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  周
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewSpan('month')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'month'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  月
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewSpan('all')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'all'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  全部
                </button>
              </div>
            </div>

            {/* 动态视图说明横幅 */}
            <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center justify-between border transition-all ${
              chartViewSpan === 'week'
                ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80'
                : chartViewSpan === 'month'
                ? 'bg-blue-50/90 text-blue-800 border-blue-200/80'
                : 'bg-purple-50/90 text-purple-800 border-purple-200/80'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                <span>
                  {chartViewSpan === 'week' && '周视图：近7日走势'}
                  {chartViewSpan === 'month' && '月视图：过去30天走势'}
                  {chartViewSpan === 'all' && '全部历史：全周期累计数据'}
                </span>
              </div>
              <span className="font-mono text-[10px] opacity-80">
                {filteredChartWeights.length} 条
              </span>
            </div>

            {/* 区间统计指标指示条 */}
            {chartStats && (
              <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">最低</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">{chartStats.min}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">最高</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.max}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">平均</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.avg}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">净变</span>
                  <span className={`text-xs font-bold font-mono ${
                    chartStats.netChange > 0 ? 'text-amber-600' : chartStats.netChange < 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}>
                    {chartStats.netChange > 0 ? `+${chartStats.netChange}` : chartStats.netChange}kg
                  </span>
                </div>
              </div>
            )}

            {/* SVG 矢量平滑折线走势图 */}
            {svgData && svgData.points.length > 0 ? (
              <div className="w-full overflow-hidden pt-1">
                <svg
                  viewBox={`0 0 ${svgData.width} ${svgData.height}`}
                  className="w-full h-36 select-none"
                >
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* 背景参考横虚线 */}
                  <line x1="36" y1="30" x2="336" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="75" x2="336" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="120" x2="336" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />

                  {/* 目标体重虚线 */}
                  {svgData.goalY !== null && weightGoal !== null && (
                    <g>
                      <line
                        x1="36" y1={svgData.goalY} x2="336" y2={svgData.goalY}
                        stroke="#3b82f6" strokeDasharray="5 4" strokeWidth="1.5"
                      />
                      <text
                        x="336" y={svgData.goalY - 5}
                        textAnchor="end" fontSize="9" fontWeight="bold" fill="#3b82f6"
                        className="font-mono"
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
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* 节点高亮圆点与文字标注 */}
                  {svgData.points.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="5" fill="#10b981" fillOpacity="0.15" />
                      <circle cx={p.x} cy={p.y} r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#0f172a"
                        className="font-mono"
                      >
                        {p.weight}
                      </text>
                      <text
                        x={p.x}
                        y={svgData.height - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#94a3b8"
                        className="font-mono"
                      >
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                该周期内暂无体重数据
              </div>
            )}
          </div>

          {renderWeightCal()}

          {/* 历史打卡日志列表 */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5 px-1 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 shrink-0">体重与日记记录</h3>
              <div className="flex items-center gap-1 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/60 text-[10px] font-bold">
                  {([
                    { key: 'all', label: '全部' },
                    { key: 'morning', label: '晨起' },
                    { key: 'post-workout', label: '练后' },
                    { key: 'evening', label: '晚间' },
                  ] as const).map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSlotFilter(f.key)}
                      className={`px-2 py-0.5 rounded-lg transition-all ${
                        slotFilter === f.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">共 {visibleWeights.length} 条</span>
              </div>
            </div>

            <div className="space-y-2">
              {visibleWeights.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 font-mono">{log.weight} kg</span>
                      <button
                        type="button"
                        onClick={() => setSlotFilter(log.timeSlot || 'morning')}
                        className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium hover:bg-emerald-50 hover:text-emerald-700"
                        title="按此时段过滤"
                      >
                        {SLOT_SHORT[log.timeSlot || 'morning']}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputDate(log.date)}
                        className="text-xs text-slate-400 font-medium hover:text-blue-600 hover:underline"
                        title="跳到该日期打卡"
                      >
                        {log.date}
                      </button>
                    </div>

                    {log.note && (
                      <div className="flex items-start gap-1.5 text-xs text-emerald-800 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{log.note}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => promptDeleteWeight(log.id, log.date, log.weight)}
                    className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="删除此条记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {visibleWeights.length === 0 && (
                <div className="text-center py-8 bg-white border border-slate-200 rounded-xl text-slate-400 text-xs">
                  当前筛选下没有记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 数据安全与备份中心 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm mt-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">本地数据中心与官方记录</h3>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          所有计划、训练动作与体重日记 100% 保存在本地。可随时导出 JSON 备份或恢复 10.06 - 10.09 官方真实记录。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleRestoreOfficialData}
            className="py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 恢复 10.06-10.09 真实记录
          </button>

          <button
            onClick={handleExportBackup}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" /> 导出 JSON 备份
          </button>

          <label className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-600" /> 导入恢复备份
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 历史训练编辑弹窗（z-70，同 id 写回；休息日仅备注可改） */}
      {editingSession && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[max(env(safe-area-inset-top),46px)] animate-fade-in"
          onClick={cancelEditSession}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)] flex flex-col shadow-2xl animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={editingSession.planName}
                  onChange={(e) => patchEditing(d => { d.planName = e.target.value; })}
                  placeholder="训练记录名称"
                  className="w-full bg-transparent font-black text-slate-900 text-sm focus:outline-none focus:border-b focus:border-blue-500 min-w-0 px-0.5 -mx-0.5"
                />
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{editingSession.date}</p>
              </div>
              <button
                type="button"
                onClick={cancelEditSession}
                className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-bold shrink-0"
              >
                关闭
              </button>
            </div>

            {/* 弹窗内容（可滚动） */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 modal-scroll overscroll-contain">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">训练备注</label>
                <textarea
                  rows={2}
                  value={editingSession.notes || ''}
                  onChange={(e) => editSessionNotes(e.target.value)}
                  placeholder="记录当日状态、器械手感等..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {!editingSession.isRestDay && editingSession.exercises.map((e, exIdx) => {
                const unitStr = e.currentUnit === 'plates' ? '片'
                  : e.currentUnit === 'assisted' ? '助力'
                  : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                return (
                  <div key={exIdx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 space-y-2">
                    {/* 动作名：可直接改名（仅改本条记录） */}
                    <input
                      type="text"
                      value={e.exerciseName}
                      onChange={(ev) => editExerciseName(exIdx, ev.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 min-w-0"
                    />
                    {/* 规格胶囊：展示当前计量单位与滑轮，点击打开规格抽屉 */}
                    <button
                      type="button"
                      onClick={() => setEditSpecExIdx(exIdx)}
                      className="w-full flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-left active:scale-[0.99] transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-500 shrink-0">规格</span>
                      <span className="text-[11px] font-bold text-indigo-700 truncate min-w-0">
                        {EDIT_UNIT_SHORT[e.currentUnit]} · {EDIT_PULLEY_SHORT[e.pulleyRatio]}{e.pulleyRatio !== 'none' ? ` (${e.pulleyRatio})` : ''}
                      </span>
                      <span className="flex-1" />
                      <Pencil className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {e.isUnilateral ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                          左右独立
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                          双侧
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => editToggleUnilateral(exIdx, !e.isUnilateral)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline shrink-0"
                      >
                        {e.isUnilateral ? '切回双侧' : '改为单侧'}
                      </button>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => { setReplaceExIdx(exIdx); setReplaceSearch(''); }}
                        className="text-[10px] font-bold text-slate-500 hover:text-blue-600 underline shrink-0"
                      >
                        换动作
                      </button>
                      {editingSession.exercises.length > 1 && (
                        <button
                          type="button"
                          onClick={() => editRemoveExercise(exIdx)}
                          className="text-[10px] font-bold text-slate-400 hover:text-red-600 underline shrink-0"
                        >
                          删动作
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {e.sets.map((s, setIdx) => (
                        <div
                          key={setIdx}
                          className="bg-white rounded-lg border border-slate-200 p-2 flex flex-wrap items-center gap-1.5"
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-black flex items-center justify-center shrink-0">
                            {s.setNumber}
                          </span>

                          {s.isDropSet && s.dropStages && s.dropStages.length > 0 ? (
                            <span className="text-[10px] text-slate-500 font-mono flex-1 min-w-0 truncate">
                              {s.dropStages.map(st => `${st.weightOrPlates}×${st.reps}`).join(' ➔ ')}
                            </span>
                          ) : s.unilateral ? (
                            <div className="flex-1 min-w-0 space-y-1">
                            {(['left', 'right'] as const).map(side => {
                              const sd: UnilateralSide = s[side] || { weight: s.weightOrPlates, reps: s.reps };
                              return (
                                <div key={side} className="grid grid-cols-[1rem_minmax(0,1fr)_auto_minmax(0,1fr)_2rem] items-center gap-1">
                                  <span className="text-[10px] font-black text-indigo-600 text-center shrink-0">
                                    {side === 'left' ? '左' : '右'}
                                  </span>
                                  <input
                                    type="number"
                                    value={sd.weight || ''}
                                    onChange={(ev) => editUnilateralField(exIdx, setIdx, side, 'weight', parseFloat(ev.target.value) || 0)}
                                    className="w-full min-w-0 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="text-[10px] text-slate-400 shrink-0">×</span>
                                  <input
                                    type="number"
                                    value={sd.reps || ''}
                                    onChange={(ev) => editUnilateralField(exIdx, setIdx, side, 'reps', parseInt(ev.target.value) || 0)}
                                    className="w-full min-w-0 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="text-[10px] text-slate-400 text-center shrink-0">{unitStr}</span>
                                </div>
                              );
                            })}
                            </div>
                          ) : (
                            <>
                              <input
                                type="number"
                                value={s.weightOrPlates || ''}
                                onChange={(ev) => editSetField(exIdx, setIdx, 'weightOrPlates', parseFloat(ev.target.value) || 0)}
                                className="w-16 min-w-0 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                              />
                              <span className="text-[10px] text-slate-400 shrink-0">{unitStr}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">×</span>
                              <input
                                type="number"
                                value={s.reps || ''}
                                onChange={(ev) => editSetField(exIdx, setIdx, 'reps', parseInt(ev.target.value) || 0)}
                                className="w-14 min-w-0 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                              />
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => editRemoveSet(exIdx, setIdx)}
                            disabled={e.sets.length <= 1}
                            className="ml-auto shrink-0 p-1.5 text-slate-300 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-300 rounded-lg"
                            title="删除该组"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => editAddSet(exIdx)}
                        className="w-full py-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-dashed border-slate-300 rounded-lg"
                      >
                        + 加一组
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">动作备注</label>
                      <input
                        type="text"
                        value={e.notes || ''}
                        onChange={(ev) => editExerciseNotes(exIdx, ev.target.value)}
                        placeholder="该动作备注（可留空）"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
              {!editingSession.isRestDay && (
                <button
                  type="button"
                  onClick={() => { setAddExOpen(true); setAddExSearch(''); }}
                  className="w-full py-2.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50/60 border border-dashed border-blue-300 rounded-xl flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 新增动作
                </button>
              )}
            </div>

            {/* 弹窗底部操作（两列等宽，320 下不挤出） */}
            <div className="p-4 pt-3 border-t border-slate-100 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancelEditSession}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveEditSession}
                  className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史编辑：规格抽屉（单位 + 滑轮），z-80 盖在编辑弹窗之上 */}
      {editingSession && editSpecExIdx !== null && editingSession.exercises[editSpecExIdx] && (
        <div
          className="fixed inset-0 z-[80] bg-slate-900/40 flex items-end justify-center animate-fade-in pt-[max(env(safe-area-inset-top),46px)]"
          onClick={() => setEditSpecExIdx(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8 shadow-2xl animate-sheet-up max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)] overflow-y-auto modal-scroll overscroll-contain"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-black text-sm mb-1">{editingSession.exercises[editSpecExIdx].exerciseName}</h3>
            <p className="text-[11px] text-slate-400 mb-3">计量规格（修改后整组同步）</p>
            <div className="text-xs font-bold text-slate-600 mb-1.5">计量单位</div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {(['plates', 'kg', 'assisted', 'bodyweight'] as ResistanceUnit[]).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => editChangeUnit(editSpecExIdx, u)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    editingSession.exercises[editSpecExIdx].currentUnit === u
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {u === 'plates' ? '插销(片)' : u === 'kg' ? '重量(kg)' : u === 'assisted' ? '助力' : '自重'}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-slate-600 mb-1.5">滑轮比例</div>
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {(['none', '1:1', '2:1'] as PulleyRatio[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => editChangePulley(editSpecExIdx, p)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    editingSession.exercises[editSpecExIdx].pulleyRatio === p
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p === 'none' ? '普通器械' : p === '1:1' ? '单滑轮 1:1' : '双滑轮 2:1'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEditSpecExIdx(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
            >
              完成
            </button>
          </div>
        </div>
      )}

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
          <div
            className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[max(env(safe-area-inset-top),46px)]"
            onClick={close}
          >
            <div
              className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)] flex flex-col p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                <h3 className="font-black text-slate-900 text-sm">
                  {replaceExIdx !== null ? '更换动作' : '新增动作到本条记录'}
                </h3>
                <button
                  type="button"
                  onClick={close}
                  className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-bold"
                >
                  关闭
                </button>
              </div>
              <div className="py-2 shrink-0">
                <input
                  type="text"
                  placeholder="搜索动作名称..."
                  value={replaceExIdx !== null ? replaceSearch : addExSearch}
                  onChange={(e) => replaceExIdx !== null ? setReplaceSearch(e.target.value) : setAddExSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* 自定义新动作：默认收起，点开才展开表单 */}
              <button
                type="button"
                onClick={() => { setShowHistoryCustomForm(v => !v); setHistoryCustomError(null); }}
                aria-expanded={showHistoryCustomForm}
                className="w-full mb-2 px-3 py-2 border border-dashed border-indigo-300 bg-indigo-50/60 rounded-xl flex items-center gap-2 text-left active:scale-[0.99] transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-xs font-black text-indigo-800 shrink-0">自定义新动作</span>
                <span className="text-[10px] text-slate-400 truncate flex-1 min-w-0">动作库里没有？在这里直接新增</span>
                {showHistoryCustomForm ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </button>

              {showHistoryCustomForm && (
                <div className="mb-2 p-3 border border-slate-200 rounded-xl bg-slate-50/70 space-y-2.5 animate-card-in shrink-0">
                  {historyCustomError && (
                    <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{historyCustomError}</p>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">动作名称 *</label>
                    <input
                      type="text"
                      value={historyCustomName}
                      onChange={(e) => setHistoryCustomName(e.target.value)}
                      placeholder="例如: 史密斯下斜推胸"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">目标肌肉群</label>
                      <select
                        value={historyCustomCategory}
                        onChange={(e) => setHistoryCustomCategory(e.target.value as MuscleCategory)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
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
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">计量单位</label>
                      <select
                        value={historyCustomUnit}
                        onChange={(e) => setHistoryCustomUnit(e.target.value as ResistanceUnit)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        <option value="plates">插销 (片)</option>
                        <option value="kg">重量 (kg)</option>
                        <option value="assisted">助力 (kg)</option>
                        <option value="bodyweight">自重</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">滑轮类型</label>
                    <select
                      value={historyCustomPulley}
                      onChange={(e) => setHistoryCustomPulley(e.target.value as PulleyRatio)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="none">普通固定器械/自由重量</option>
                      <option value="1:1">单滑轮 1:1</option>
                      <option value="2:1">双滑轮 2:1</option>
                    </select>
                  </div>
                  <label className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 cursor-pointer">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-slate-800">左右独立动作（单侧）</span>
                      <span className="block text-[10px] text-slate-400">开启后左右分别记录</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={historyCustomUnilateral}
                      onChange={(e) => setHistoryCustomUnilateral(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 shrink-0"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setHistoryCustomName(''); setHistoryCustomNotes(''); setHistoryCustomUnilateral(false); setHistoryCustomError(null); }}
                      className="py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                    >
                      清空
                    </button>
                    <button
                      type="button"
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
                      className="py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95"
                    >
                      保存并加入本记录
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5 modal-scroll overscroll-contain">
                {pool.map(ex => (
                  <div
                    key={ex.id}
                    onClick={() => pick(ex)}
                    className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200/90 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 text-xs truncate">{ex.name}</span>
                      {ex.isUnilateral && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded shrink-0">
                          单侧
                        </span>
                      )}
                      {ex.isCustom && (
                        <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1 py-0.5 rounded shrink-0">
                          自建
                        </span>
                      )}
                    </div>
                    <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                  </div>
                ))}
                {pool.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-6">没有匹配的动作，换个关键词试试</p>
                )}
              </div>
            </div>
          </div>
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
