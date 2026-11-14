import { useState, useEffect, useMemo } from 'react';
import {
  Play, Plus, Check, Trash2, Flame, ArrowLeftRight,
  Sparkles, Award, Coffee,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Pencil, Settings as SettingsIcon,
} from 'lucide-react';
import {
  WorkoutPlan, WorkoutSession, ExerciseLog, WorkoutSet, DropStage,
  ResistanceUnit, PulleyRatio, MuscleCategory, CATEGORY_LABELS, UNIT_LABELS, Exercise,
  UnilateralSide
} from '../types';
import { StorageService } from '../utils/storage';
import { buildSessionFromPlan } from '../utils/sessionBuilder';
import {
  formatDropStagesSummary,
  formatWorkoutSetSummary,
  newSessionCardioDefaults,
  newSessionPulleyRatio,
  normalizePulleyForUnit,
  requiresWeightInput,
  seedWeightsOnly,
  validateWorkoutSetForCompletion,
  WorkoutSetMode,
} from '../utils/trainingRules';
import { todayLocalDate, yesterdayLocalDate } from '../utils/date';
import { withAutoRestDays } from '../utils/autoRest';
import { useAppSettings } from '../settings/AppSettingsContext';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { ConfirmSheet } from './ConfirmSheet';
import { Badge, Button, Card, IconButton, NumberText, SegmentedControl, Sheet, cx } from '../ui';

interface WorkoutViewProps {
  onOpenPlansTab: () => void;
  allExercises: Exercise[];
  onFocusModeChange?: (inFocus: boolean) => void;
  onRefreshExercises?: () => void;
  onOpenSettings: () => void;
}

// 分化罗盘定义：胸 → 背 → 肩 → 腿 → 休
const CYCLE_ORDER = ['chest', 'back', 'shoulder', 'leg', 'rest'] as const;
type CycleKey = (typeof CYCLE_ORDER)[number];
const CYCLE_LABEL: Record<CycleKey, string> = {
  chest: '胸',
  back: '背',
  shoulder: '肩',
  leg: '腿',
  rest: '休',
};

// 智能分化推断：优先按该场训练实际完成动作的肌肉部位统计，彻底解决自由训练与自定义名称误判
function inferSessionCategory(session: WorkoutSession): CycleKey | null {
  if (session.isRestDay) return 'rest';

  // 1. 优先统计实际动作的肌肉部位
  const score: Record<'chest' | 'back' | 'shoulder' | 'leg', number> = {
    chest: 0,
    back: 0,
    shoulder: 0,
    leg: 0,
  };

  for (const ex of session.exercises) {
    const completedCount = ex.sets.filter(s => s.completed).length;
    // 如果还没打勾任何组，按动作计划组数权重减半计入，已打勾则以完成组数计入
    const weight = completedCount > 0 ? completedCount : ex.sets.length * 0.5;
    if (weight <= 0) continue;

    const cat = ex.category;
    if (cat === 'chest' || cat === 'triceps') {
      score.chest += weight;
    } else if (cat === 'back' || cat === 'biceps') {
      score.back += weight;
    } else if (cat === 'shoulder' || cat === 'abs') {
      score.shoulder += weight;
    } else if (cat === 'leg') {
      score.leg += weight;
    }
  }

  const entries = (['chest', 'back', 'shoulder', 'leg'] as const)
    .map(k => ({ key: k, count: score[k] }))
    .sort((a, b) => b.count - a.count);

  if (entries[0] && entries[0].count > 0) {
    return entries[0].key;
  }

  // 2. 无动作或动作部位未命中时，按计划名称关键字推断
  const name = session.planName || '';
  if (name.includes('胸')) return 'chest';
  if (name.includes('背')) return 'back';
  if (name.includes('肩')) return 'shoulder';
  if (name.includes('腿')) return 'leg';
  if (name.includes('休')) return 'rest';

  return null;
}


const fieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';

const UNIT_OPTIONS = [
  { value: 'plates', label: '插片' },
  { value: 'kg', label: 'kg' },
  { value: 'assisted', label: '助力' },
  { value: 'bodyweight', label: '自重' },
] as const;

const PULLEY_OPTIONS = [
  { value: '1:1', label: '1:1' },
  { value: '2:1', label: '2:1' },
] as const;

const RECORD_MODE_OPTIONS = [
  { value: 'both', label: '双侧' },
  { value: 'unilateral', label: '左右分开' },
] as const;

const ADD_SHEET_OPTIONS = [
  { value: 'library', label: '从动作库选择' },
  { value: 'custom', label: '自定义新动作' },
] as const;

const CARDIO_MODE_OPTIONS = [
  { value: 'none', label: '无有氧' },
  { value: 'yes', label: '有有氧' },
] as const;

// 计划名里沿用了数据中的彩色 emoji，展示时统一成单色加号
const displayPlanName = (name: string) => name.replace(/➕/g, '+');

// 未预设递减阶梯时使用的默认四阶；插片用整数，其余沿用 kg 的 2.5 递减
const makeDefaultDropStages = (unit: ResistanceUnit): DropStage[] => {
  const weights = unit === 'plates' ? [10, 8, 6, 4] : [10, 7.5, 5, 2.5];
  const reps = [12, 12, 10, 12];
  return weights.map((weightOrPlates, index) => ({
    id: `default-stage-${index + 1}`,
    weightOrPlates: unit === 'bodyweight' ? 0 : weightOrPlates,
    unit,
    reps: reps[index],
  }));
};

// 单侧组不再在行内重复单位标签；单位统一由动作规格胶囊展示

export const WorkoutView: React.FC<WorkoutViewProps> = ({
  onOpenPlansTab,
  allExercises,
  onFocusModeChange,
  onRefreshExercises,
  onOpenSettings,
}) => {
  const { settings } = useAppSettings();
  const todayDateStr = todayLocalDate();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [showAddExModal, setShowAddExModal] = useState(false);
  // 添加动作面板：从动作库选择 / 自定义新动作两个标签页
  const [addSheetTab, setAddSheetTab] = useState<'library' | 'custom'>('library');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<MuscleCategory>('chest');
  const [customUnit, setCustomUnit] = useState<ResistanceUnit>('plates');
  const [customUnilateral, setCustomUnilateral] = useState(false);
  const [customDropSet, setCustomDropSet] = useState(false);
  const [customNotes, setCustomNotes] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [backfillDate, setBackfillDate] = useState(() => yesterdayLocalDate());
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  // 今日状态卡三段切换：开练 / 休息 / 补签
  const [statusCardTab, setStatusCardTab] = useState<'train' | 'rest' | 'backfill'>('train');

  // ---- 专注模式状态 ----
  const [focusIdx, setFocusIdx] = useState(0);            // 当前聚焦第几个动作
  const [isEditingPlanName, setIsEditingPlanName] = useState(false); // 自由训练/专注模式训练名称编辑态
  const [specExIdx, setSpecExIdx] = useState<number | null>(null); // 规格抽屉作用于哪个动作
  const [expandedDropSets, setExpandedDropSets] = useState<Set<string>>(new Set()); // 展开的大组 id
  const [showCardio, setShowCardio] = useState(false);    // 有氧折叠
  const [showNotes, setShowNotes] = useState(false);      // 备注折叠
  const [setCompletionErrors, setSetCompletionErrors] = useState<Record<string, string>>({});
  const [finishError, setFinishError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; confirmText: string; danger: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmText: '确定', danger: true, onConfirm: () => {} });

  // 未训练日自动休息：把已结束的空白日派生成只读休息记录（不写 localStorage）
  const effectiveSessions = useMemo(
    () => withAutoRestDays(sessions, todayDateStr, settings.autoRest),
    [sessions, todayDateStr, settings.autoRest],
  );

  // 今日状态卡：自动休息开启时不再显示补签段
  const statusOptions = useMemo(() => {
    const options: Array<{ value: 'train' | 'rest' | 'backfill'; label: string }> = [
      { value: 'train', label: '开练' },
      { value: 'rest', label: '今日休息' },
    ];
    if (settings.showBackfill && !settings.autoRest) {
      options.push({ value: 'backfill', label: '补签' });
    }
    return options;
  }, [settings.showBackfill, settings.autoRest]);

  useEffect(() => {
    if (statusCardTab === 'backfill' && (!settings.showBackfill || settings.autoRest)) {
      setStatusCardTab('train');
    }
  }, [statusCardTab, settings.showBackfill, settings.autoRest]);

  // 弹窗打开时锁住底层 body 滚动，彻底杜绝滚动穿透
  useLockBodyScroll(specExIdx !== null || showAddExModal || showFinishModal || confirmState.open);

  // 每次打开添加面板都回到「从动作库选择」，避免上次停留在自定义标签页
  const openAddExerciseSheet = () => {
    setAddSheetTab('library');
    setCustomError(null);
    setShowAddExModal(true);
  };

  useEffect(() => {
    setPlans(StorageService.getPlans());
    setSessions(StorageService.getSessions());
    const savedActive = StorageService.getActiveSession();
    if (savedActive) {
      setActiveSession(savedActive);
    }
  }, []);

  // 通知 App 是否进入专注模式（隐藏/显示底部导航）
  useEffect(() => {
    if (onFocusModeChange) onFocusModeChange(Boolean(activeSession));
  }, [activeSession, onFocusModeChange]);

  useEffect(() => () => {
    if (onFocusModeChange) onFocusModeChange(false);
  }, [onFocusModeChange]);

  // 同步活动状态到本地缓存
  const updateActiveSession = (updated: WorkoutSession | null) => {
    // 修改次数或切换组结构后，缺少本次次数的组需重新确认完成。
    updated?.exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        if (set.completed && validateWorkoutSetForCompletion(set)) set.completed = false;
      });
    });
    setActiveSession(updated);
    StorageService.saveActiveSession(updated);
  };

  // 启动某个计划（统一走 sessionBuilder，与计划页一键开练共用同一构造逻辑，
  // 保证超级组阶梯预设在两条入口都不会丢失）
  const startPlan = (plan: WorkoutPlan) => {
    setFocusIdx(0);
    setExpandedDropSets(new Set());
    setShowCardio(false);
    setShowNotes(false);
    updateActiveSession(buildSessionFromPlan(plan, allExercises));
  };

  // 启动自由训练
  const startFreeWorkout = () => {
    const newSession: WorkoutSession = {
      id: `sess-${Date.now()}`,
      date: todayLocalDate(),
      planName: '自由训练',
      startTime: Date.now(),
      exercises: [],
      ...newSessionCardioDefaults(),
    };
    setFocusIdx(0);
    updateActiveSession(newSession);
  };

  // 添加新动作到当前训练
  const addExerciseToCurrent = (exercise: Exercise) => {
    if (!activeSession) return;
    const lastLog = StorageService.getLastExerciseLog(exercise.id);
    const unit = exercise.defaultUnit;

    // 动作库决定训练模式；历史只提供同单位重量提示。
    const presetStages = exercise.dropStages?.length ? exercise.dropStages : null;
    const shouldDrop = Boolean(exercise.isDropSet);
    // 超级组与左右独立互斥
    const exIsUnilateral = !shouldDrop && Boolean(exercise.isUnilateral);
    const mode: WorkoutSetMode = shouldDrop ? 'drop' : exIsUnilateral ? 'unilateral' : 'standard';
    const historySets = (lastLog?.sets || []).filter(set =>
      set.completed && seedWeightsOnly(set, unit, mode) !== null,
    );

    // 重复动作只带同单位重量，次数始终留空；首次训练则重量和次数都留空。
    const defaultSets: WorkoutSet[] = [1, 2, 3, 4].map((num, index) => {
      const weightSeed = seedWeightsOnly(
        historySets[index] || historySets[historySets.length - 1],
        unit,
        mode,
      );
      const newSet: WorkoutSet = {
        id: `s-${Date.now()}-${num}`,
        setNumber: num,
        unit,
        weightOrPlates: weightSeed?.weightOrPlates ?? 0,
        reps: 0,
        completed: false,
        pulleyRatio: newSessionPulleyRatio(),
      };
      if (shouldDrop) {
        const sourceStages = presetStages || weightSeed?.dropStages || makeDefaultDropStages(unit);
        const matchingHistory = weightSeed?.dropStages?.length === sourceStages.length
          ? weightSeed.dropStages
          : undefined;
        const stages = sourceStages.map((stage, stageIndex) => ({
          ...stage,
          id: `${newSet.id}-stage-${stageIndex + 1}`,
          unit,
          weightOrPlates: unit === 'bodyweight' || stage.unit !== unit
            ? 0
            : (matchingHistory?.[stageIndex].weightOrPlates ?? stage.weightOrPlates),
          reps: 0,
        }));
        newSet.isDropSet = true;
        newSet.weightOrPlates = stages[0]?.weightOrPlates ?? 0;
        newSet.dropStages = stages;
      } else if (exIsUnilateral) {
        const leftWeight = weightSeed?.left?.weight ?? 0;
        const rightWeight = weightSeed?.right?.weight ?? 0;
        newSet.unilateral = true;
        newSet.weightOrPlates = leftWeight;
        newSet.left = { weight: leftWeight, reps: 0 };
        newSet.right = { weight: rightWeight, reps: 0 };
      }
      return newSet;
    });

    const newExLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      pulleyRatio: newSessionPulleyRatio(),
      currentUnit: unit,
      isUnilateral: exIsUnilateral || undefined,
      sets: defaultSets,
      notes: exercise.notes || ''
    };

    const updated: WorkoutSession = {
      ...activeSession,
      exercises: [...activeSession.exercises, newExLog]
    };
    updateActiveSession(updated);
    setShowAddExModal(false);
    // 聚焦到新加入的动作
    setFocusIdx(updated.exercises.length - 1);
  };

  // 勾选/取消完成某一组
  const toggleSetComplete = (exIndex: number, setIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const ex = exercises[exIndex];
    const targetSet = ex.sets[setIndex];
    if (!targetSet.completed) {
      const error = validateWorkoutSetForCompletion(targetSet);
      if (error) {
        setSetCompletionErrors(prev => ({ ...prev, [targetSet.id]: error }));
        return;
      }
    }
    targetSet.completed = !targetSet.completed;
    setSetCompletionErrors(prev => {
      const next = { ...prev };
      delete next[targetSet.id];
      return next;
    });
    updateActiveSession({ ...activeSession, exercises });
  };

  // 修改组数据
  const updateSetField = (exIndex: number, setIndex: number, field: 'weightOrPlates' | 'reps', delta: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    const currentVal = targetSet[field];
    const nextVal = Math.max(0, currentVal + delta);
    targetSet[field] = field === 'weightOrPlates' && !requiresWeightInput(targetSet.unit) ? 0 : nextVal;
    if (field === 'reps') {
      setSetCompletionErrors(prev => {
        const next = { ...prev };
        delete next[targetSet.id];
        return next;
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  const setDirectVal = (exIndex: number, setIndex: number, field: 'weightOrPlates' | 'reps', val: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    targetSet[field] = field === 'weightOrPlates' && !requiresWeightInput(targetSet.unit)
      ? 0
      : Math.max(0, val);
    if (field === 'reps') {
      setSetCompletionErrors(prev => {
        const next = { ...prev };
        delete next[targetSet.id];
        return next;
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 左右独立普通组：修改某一侧（左/右）的重量或次数（± 微调）
  const updateUnilateralField = (
    exIndex: number, setIndex: number, side: 'left' | 'right',
    field: 'weight' | 'reps', delta: number
  ) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    const base: UnilateralSide = targetSet[side] || { weight: targetSet.weightOrPlates, reps: targetSet.reps };
    const next: UnilateralSide = { weight: base.weight, reps: base.reps };
    next[field] = field === 'weight' && !requiresWeightInput(targetSet.unit)
      ? 0
      : Math.max(0, next[field] + delta);
    targetSet[side] = next;
    targetSet.unilateral = true;
    // 主字段保持左侧副本，兼容未分侧渲染与历史摘要
    if (targetSet.left) {
      targetSet.weightOrPlates = targetSet.left.weight;
      targetSet.reps = targetSet.left.reps;
    }
    if (field === 'reps') {
      setSetCompletionErrors(prev => {
        const next = { ...prev };
        delete next[targetSet.id];
        return next;
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 左右独立普通组：直接输入某一侧的重量或次数
  const setUnilateralDirectVal = (
    exIndex: number, setIndex: number, side: 'left' | 'right',
    field: 'weight' | 'reps', val: number
  ) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    const base: UnilateralSide = targetSet[side] || { weight: targetSet.weightOrPlates, reps: targetSet.reps };
    const next: UnilateralSide = { weight: base.weight, reps: base.reps };
    next[field] = field === 'weight' && !requiresWeightInput(targetSet.unit)
      ? 0
      : Math.max(0, val);
    targetSet[side] = next;
    targetSet.unilateral = true;
    if (targetSet.left) {
      targetSet.weightOrPlates = targetSet.left.weight;
      targetSet.reps = targetSet.left.reps;
    }
    if (field === 'reps') {
      setSetCompletionErrors(prev => {
        const next = { ...prev };
        delete next[targetSet.id];
        return next;
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 修改超级组阶梯数值 (某个递减阶段的重量或次数)
  const setDropStageDirectVal = (exIndex: number, setIndex: number, stageIndex: number, field: 'weightOrPlates' | 'reps', val: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages) return;
    targetSet.dropStages[stageIndex][field] =
      field === 'weightOrPlates' && !requiresWeightInput(targetSet.unit)
        ? 0
        : Math.max(0, val);
    if (field === 'reps') {
      setSetCompletionErrors(prev => {
        const next = { ...prev };
        delete next[targetSet.id];
        return next;
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 为某个大组增加一个递减阶梯
  const addDropStageToSet = (exIndex: number, setIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages) targetSet.dropStages = [];
    const lastStg = targetSet.dropStages[targetSet.dropStages.length - 1];
    const unit = targetSet.unit;
    const newWeight = !requiresWeightInput(unit)
      ? 0
      : lastStg
        ? Math.max(0, lastStg.weightOrPlates - (unit === 'plates' ? 2 : 2.5))
        : 5;
    targetSet.dropStages.push({
      id: `stg-${Date.now()}`,
      weightOrPlates: newWeight,
      unit,
      reps: 0,
    });
    updateActiveSession({ ...activeSession, exercises });
  };

  // 删除某个递减阶梯
  const removeDropStageFromSet = (exIndex: number, setIndex: number, stageIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages || targetSet.dropStages.length <= 1) return;
    targetSet.dropStages.splice(stageIndex, 1);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 增加一组 (或超级组加大组)
  const addSetToExercise = (exIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const ex = exercises[exIndex];
    const lastSet = ex.sets[ex.sets.length - 1];
    const isDrop = Boolean(lastSet?.isDropSet);
    const mode: WorkoutSetMode = isDrop ? 'drop' : ex.isUnilateral ? 'unilateral' : 'standard';
    const unit = lastSet?.unit || ex.currentUnit;
    const completedSets = ex.sets.filter(set => set.completed);
    const historyLog = StorageService.getLastExerciseLog(ex.exerciseId);
    const historySets = (historyLog?.sets || []).filter(set =>
      set.completed && seedWeightsOnly(set, unit, mode) !== null,
    );
    const weightSeed = seedWeightsOnly(
      completedSets[completedSets.length - 1] || lastSet || historySets[historySets.length - 1],
      unit,
      mode,
    );
    const newSetId = `s-${Date.now()}-${ex.sets.length + 1}`;

    const newSet: WorkoutSet = {
      id: newSetId,
      setNumber: ex.sets.length + 1,
      unit,
      weightOrPlates: weightSeed?.weightOrPlates ?? 0,
      reps: 0,
      completed: false,
      pulleyRatio: ex.pulleyRatio,
      isDropSet: isDrop,
      dropStages: isDrop
        ? (weightSeed?.dropStages || makeDefaultDropStages(unit)).map((stage, index) => ({
            ...stage,
            id: `${newSetId}-stage-${index + 1}`,
            unit,
            weightOrPlates: unit === 'bodyweight' ? 0 : stage.weightOrPlates,
            reps: 0,
          }))
        : undefined,
    };
    // 左右独立动作（普通组）：新组只沿用同单位重量，左右次数都留空。
    if (ex.isUnilateral && !isDrop) {
      newSet.unilateral = true;
      newSet.left = {
        weight: weightSeed?.left?.weight ?? newSet.weightOrPlates,
        reps: 0,
      };
      newSet.right = {
        weight: weightSeed?.right?.weight ?? newSet.weightOrPlates,
        reps: 0,
      };
      newSet.weightOrPlates = newSet.left.weight;
    }
    ex.sets.push(newSet);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 删除一组
  const removeSet = (exIndex: number, setIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    exercises[exIndex].sets.splice(setIndex, 1);
    exercises[exIndex].sets.forEach((s, idx) => s.setNumber = idx + 1);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 切换动作单位（片 / kg / 自重 / 助力）
  const changeExerciseUnit = (exIndex: number, newUnit: ResistanceUnit) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const previousUnit = exercises[exIndex].currentUnit;
    const unitChanged = previousUnit !== newUnit;
    exercises[exIndex].currentUnit = newUnit;
    exercises[exIndex].sets.forEach(s => {
      s.unit = newUnit;
      // 超级组阶梯使用独立单位字段，换单位时一并同步
      s.dropStages?.forEach(stage => {
        stage.unit = newUnit;
        if (newUnit === 'bodyweight' || unitChanged) stage.weightOrPlates = 0;
      });
      if (newUnit === 'bodyweight' || unitChanged) {
        s.weightOrPlates = 0;
        if (s.left) s.left.weight = 0;
        if (s.right) s.right.weight = 0;
      }
    });
    if (newUnit === 'bodyweight') {
      exercises[exIndex].pulleyRatio = 'none';
      exercises[exIndex].sets.forEach(s => { s.pulleyRatio = 'none'; });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 切换滑轮比例（单滑轮 / 双滑轮 / 无）
  const changePulleyRatio = (exIndex: number, ratio: PulleyRatio) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const unit = exercises[exIndex].currentUnit;
    const normalized = normalizePulleyForUnit(unit, ratio);
    exercises[exIndex].pulleyRatio = normalized;
    exercises[exIndex].sets.forEach(s => s.pulleyRatio = normalized);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 切换左右手分开记录：开启时为每组补左右值，关闭时清除分侧标记但保留主字段
  // rememberToLibrary 为真时同时写回动作库（以后该动作默认单侧）
  const changeRecordMode = (exIndex: number, unilateral: boolean, rememberToLibrary: boolean) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const target = exercises[exIndex];
    target.isUnilateral = unilateral || undefined;
    target.sets.forEach(s => {
      // 超级组阶梯不支持分侧，保持原样
      if (s.isDropSet) return;
      if (unilateral) {
        s.unilateral = true;
        if (!s.left) s.left = { weight: s.weightOrPlates, reps: s.reps };
        if (!s.right) s.right = { weight: s.weightOrPlates, reps: s.reps };
        s.weightOrPlates = s.left.weight;
        s.reps = s.left.reps;
      } else {
        s.unilateral = undefined;
        s.left = undefined;
        s.right = undefined;
      }
    });
    updateActiveSession({ ...activeSession, exercises });

    if (rememberToLibrary) {
      const all = StorageService.getExercises();
      const ex = all.find(e => e.id === target.exerciseId);
      if (ex) {
        ex.isUnilateral = unilateral || undefined;
        StorageService.saveExercises(all);
        if (onRefreshExercises) onRefreshExercises();
      }
    }
  };

  // 训练中切换递减超级组：与左右独立互斥，切换时重建当前组结构
  const changeExerciseDropMode = (exIndex: number, enabled: boolean) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const target = exercises[exIndex];
    if (enabled) {
      const existingStages = target.sets.find(s => s.dropStages?.length)?.dropStages
        || StorageService.getLastExerciseLog(target.exerciseId)?.sets.find(s => s.isDropSet && s.dropStages?.length)?.dropStages;
      target.isUnilateral = undefined;
      target.sets = target.sets.map((set) => {
        const unit = set.unit;
        const template = existingStages?.length ? existingStages : makeDefaultDropStages(unit);
        const stages = template.map((stage, index) => ({
          ...stage,
          id: `${set.id}-stage-${index + 1}`,
          unit,
          weightOrPlates: unit === 'bodyweight' || stage.unit !== unit ? 0 : stage.weightOrPlates,
          reps: 0,
        }));
        if (set.weightOrPlates && stages[0]) {
          stages[0] = {
            ...stages[0],
            weightOrPlates: unit === 'bodyweight' ? 0 : set.weightOrPlates,
          };
        }
        return {
          ...set,
          isDropSet: true,
          dropStages: stages,
          unilateral: undefined,
          left: undefined,
          right: undefined,
          weightOrPlates: stages[0]?.weightOrPlates ?? set.weightOrPlates,
          reps: 0,
        };
      });
    } else {
      target.sets = target.sets.map((set) => {
        const firstStage = set.dropStages?.[0];
        return {
          ...set,
          isDropSet: undefined,
          dropStages: undefined,
          weightOrPlates: firstStage?.weightOrPlates ?? set.weightOrPlates,
          reps: 0,
        };
      });
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 在自由训练中新建自定义动作：写入动作库后立即加入本次训练
  const createAndAddCustomExercise = (data: {
    name: string; category: MuscleCategory; defaultUnit: ResistanceUnit;
    isUnilateral: boolean; isDropSet: boolean;
    dropStages?: DropStage[]; notes: string;
  }): boolean => {
    if (!activeSession) return false;
    const created = StorageService.addCustomExercise({
      name: data.name.trim(),
      category: data.category,
      defaultUnit: data.defaultUnit,
      defaultPulley: 'none',
      isUnilateral: data.isDropSet ? undefined : (data.isUnilateral || undefined),
      isDropSet: data.isDropSet || undefined,
      dropStages: data.isDropSet
        ? (data.dropStages?.length ? data.dropStages : makeDefaultDropStages(data.defaultUnit))
        : undefined,
      notes: data.notes.trim() || undefined,
      isFavorite: true,
    });
    if (onRefreshExercises) onRefreshExercises();
    addExerciseToCurrent(created);
    return true;
  };

  // 删除动作
  const removeExercise = (exIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    exercises.splice(exIndex, 1);
    updateActiveSession({ ...activeSession, exercises });
    setFocusIdx(prev => Math.max(0, Math.min(prev, exercises.length - 1)));
  };

  // 训练中有氧：无有氧 / 有有氧 + 自定义时长
  const setCardioMode = (enabled: boolean) => {
    if (!activeSession) return;
    updateActiveSession({
      ...activeSession,
      cardioCompleted: enabled,
      cardioMinutes: enabled
        ? (activeSession.cardioMinutes && activeSession.cardioMinutes > 0 ? activeSession.cardioMinutes : 20)
        : 0,
      cardioType: enabled ? activeSession.cardioType : undefined,
      cardioNotes: enabled ? activeSession.cardioNotes : undefined,
    });
    setFinishError(null);
  };

  const setCardioMinutes = (minutes: number) => {
    if (!activeSession) return;
    updateActiveSession({ ...activeSession, cardioMinutes: Math.max(0, Math.round(minutes)) });
    setFinishError(null);
  };

  // 完成结算
  const finishSession = () => {
    if (!activeSession) return;
    const completedSets = activeSession.exercises.flatMap(exercise => exercise.sets).filter(set => set.completed);
    if (completedSets.some(set => validateWorkoutSetForCompletion(set))) {
      setFinishError('已完成组中仍有次数未填写，请返回补全或取消完成。');
      return;
    }
    if (completedSets.length === 0 && !activeSession.cardioCompleted) {
      setFinishError('还没有完成任何一组。请返回记录，或选择放弃本次训练。');
      return;
    }
    // 有氧入口被设置隐藏时不阻断归档：沿用已有有氧数据，不强迫用户编辑不可见字段
    if (settings.showCardio && activeSession.cardioCompleted) {
      const minutes = Math.round(activeSession.cardioMinutes || 0);
      if (minutes < 1 || minutes > 300) {
        setFinishError('有氧时长请填写 1–300 分钟');
        return;
      }
    }
    setFinishError(null);
    const finalSession: WorkoutSession = {
      ...activeSession,
      endTime: Date.now()
    };
    // 归档前统一有氧字段；启用有氧必须由训练完成界面的手动选择产生。
    if (finalSession.cardioCompleted) {
      finalSession.cardioMinutes = Math.round(finalSession.cardioMinutes);
      finalSession.cardioType = (finalSession.cardioType || '').trim() || undefined;
      finalSession.cardioNotes = (finalSession.cardioNotes || '').trim() || undefined;
    } else {
      finalSession.cardioMinutes = 0;
      finalSession.cardioType = undefined;
      finalSession.cardioNotes = undefined;
    }
    StorageService.addSession(finalSession);
    StorageService.saveActiveSession(null);
    setActiveSession(null);
    setSessions(StorageService.getSessions());
    setShowFinishModal(false);
    setFocusIdx(0);
  };

  // 一键打卡今日完全休息
  const handleLogRestDay = () => {
    const todayStr = todayLocalDate();
    const restSession: WorkoutSession = {
      id: `sess-rest-${Date.now()}`,
      date: todayStr,
      planName: '休息日 (完全休息)',
      startTime: Date.now(),
      endTime: Date.now(),
      exercises: [],
      cardioMinutes: 0,
      cardioCompleted: false,
      isRestDay: true,
      notes: '完全休息',
    };
    StorageService.addSession(restSession);
    setSessions(StorageService.getSessions());
  };

  // 取消今日休息日打卡（自建抽屉确认）
  const handleCancelRestDay = (sessionId: string) => {
    setConfirmState({
      open: true,
      title: '取消今日休息日',
      description: '确定取消今日休息日打卡，重新开启训练吗？',
      confirmText: '取消打卡',
      danger: false,
      onConfirm: () => {
        StorageService.deleteSession(sessionId);
        setSessions(StorageService.getSessions());
        setConfirmState(prev => ({ ...prev, open: false }));
      },
    });
  };

  // 放弃本次训练（自建抽屉确认）
  const handleAbandonSession = () => {
    setConfirmState({
      open: true,
      title: '放弃本次训练',
      description: '确定放弃并清空当前正在记录的训练吗？未归档的数据将丢失。',
      confirmText: '放弃训练',
      danger: true,
      onConfirm: () => {
        updateActiveSession(null);
        setFocusIdx(0);
        setConfirmState(prev => ({ ...prev, open: false }));
      },
    });
  };

  // 补签过去某一天的休息日（只能补今天之前的日期，且当天无任何记录）
  const handleBackfillRestDay = () => {
    if (!backfillDate) {
      setBackfillMsg('请先选择要补签的日期');
      return;
    }
    if (backfillDate >= todayLocalDate()) {
      setBackfillMsg('只能补签今天之前的日期');
      return;
    }
    if (sessions.some(s => s.date === backfillDate)) {
      setBackfillMsg(`${backfillDate} 已有训练或休息记录，无需补签`);
      return;
    }
    const restSession: WorkoutSession = {
      id: `sess-rest-${Date.now()}`,
      date: backfillDate,
      planName: '休息日 (完全休息)',
      startTime: Date.now(),
      endTime: Date.now(),
      exercises: [],
      cardioMinutes: 0,
      cardioCompleted: false,
      isRestDay: true,
      notes: '完全休息（补签）',
    };
    StorageService.addSession(restSession);
    setSessions(StorageService.getSessions());
    setBackfillMsg(`已补签 ${backfillDate} 的休息`);
  };

  // 切换大组展开/折叠
  const toggleDropSetExpanded = (setId: string) => {
    setExpandedDropSets(prev => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  // 计算已完成总组数与总计划组数
  const totalCompletedSets = activeSession?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0
  ) || 0;
  const totalAllSets = activeSession?.exercises.reduce(
    (acc, ex) => acc + ex.sets.length, 0
  ) || 0;

  // 检查今日是否已安排休息日（只认手动打卡，自动休息不生成今日记录）
  const todayRestSession = sessions.find(s => s.date === todayDateStr && s.isRestDay);

  // 每个动作最近一次已完成训练日志：一次扫描建 Map，
  // 替代原先每张动作卡片各自全量查找（语义与 getLastExerciseLog 一致：按日期降序取首个命中）
  const lastLogMap = useMemo(() => {
    const map = new Map<string, ExerciseLog>();
    for (const session of sessions) {
      for (const exLog of session.exercises) {
        if (!map.has(exLog.exerciseId) && exLog.sets.some(s => s.completed)) {
          map.set(exLog.exerciseId, exLog);
        }
      }
    }
    return map;
  }, [sessions]);

  // 分化罗盘：优先按最近一次训练实际完成动作的肌肉部位推断（彻底告别自由训练误判为胸）
  const compass = useMemo(() => {
    // 候选池：若当前正在训练且已有完成动作，将当前会话也纳入实时考量；历史会话按日期+时间倒序扫描
    const candidates: WorkoutSession[] = [];
    if (activeSession && activeSession.exercises.some(e => e.sets.some(s => s.completed))) {
      candidates.push(activeSession);
    }
    candidates.push(...effectiveSessions);

    let lastKey: CycleKey | null = null;
    let targetSession: WorkoutSession | null = null;

    for (const sess of candidates) {
      const cat = inferSessionCategory(sess);
      if (cat) {
        lastKey = cat;
        targetSession = sess;
        break;
      }
    }

    if (!lastKey || !targetSession) {
      return { lastKey: null as CycleKey | null, suggestKey: 'chest' as CycleKey, daysAgo: null as number | null };
    }

    const lastIdx = CYCLE_ORDER.indexOf(lastKey);
    const suggestKey = CYCLE_ORDER[(lastIdx + 1) % CYCLE_ORDER.length];

    // 距今天数
    const today = new Date(todayDateStr + 'T00:00:00');
    const last = new Date(targetSession.date + 'T00:00:00');
    const daysAgo = Math.max(0, Math.round((today.getTime() - last.getTime()) / 86400000));

    return { lastKey, suggestKey, daysAgo };
  }, [effectiveSessions, activeSession, todayDateStr]);

  // 推荐计划：按罗盘建议部位匹配计划名称，仅作视觉提示，不改变开练逻辑
  const suggestedPlanId = useMemo(() => {
    if (compass.suggestKey === 'rest') return null;
    const label = CYCLE_LABEL[compass.suggestKey];
    return plans.find(p => p.name.includes(label))?.id ?? null;
  }, [plans, compass.suggestKey]);

  // 分化罗盘条
  const renderCompass = (compact = false) => {
    const lastLabel = compass.lastKey ? CYCLE_LABEL[compass.lastKey] : null;
    return (
      <div className="mt-2">
        <div className="flex gap-1 rounded-ctl bg-surface-subtle p-1" role="list" aria-label="分化罗盘">
          {CYCLE_ORDER.map((key) => {
            const isLast = compass.lastKey === key;
            const isSuggest = compass.suggestKey === key;
            return (
              <div
                key={key}
                role="listitem"
                aria-current={isSuggest ? 'step' : undefined}
                className={cx(
                  'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[8px] text-cap font-medium',
                  isSuggest
                    ? 'border border-line bg-surface font-semibold text-ink'
                    : isLast
                      ? 'text-ink-2'
                      : 'text-ink-3',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    isSuggest
                      ? compass.suggestKey === 'rest' ? 'bg-warning' : 'bg-accent'
                      : isLast ? 'bg-success' : 'bg-line-strong',
                  )}
                />
                {CYCLE_LABEL[key]}
              </div>
            );
          })}
        </div>
        {!compact && (
          <p className="mt-1.5 text-cap text-ink-3">
            {lastLabel
              ? `上次 ${lastLabel}${compass.daysAgo === null ? '' : compass.daysAgo === 0 ? ' · 今天' : ` · ${compass.daysAgo} 天前`}`
              : '还没有训练记录'}
            <span aria-hidden="true" className="mx-1.5 text-line-strong">|</span>
            建议 {CYCLE_LABEL[compass.suggestKey]}
          </p>
        )}
      </div>
    );
  };

  // 上次参考一行摘要
  const lastLogSummary = (lastLog: ExerciseLog | null, current: ExerciseLog | null): string | null => {
    if (!lastLog) return null;
    const currentSet = current?.sets[0];
    if (!currentSet) return null;
    const mode: WorkoutSetMode = currentSet.isDropSet
      ? 'drop'
      : currentSet.unilateral
        ? 'unilateral'
        : 'standard';
    const done = lastLog.sets.filter(s =>
      s.completed && seedWeightsOnly(s, current.currentUnit, mode) !== null,
    );
    if (done.length === 0) return null;
    const dropSet = done.find(s => s.isDropSet && s.dropStages?.length);
    if (dropSet?.dropStages?.length) {
      return `超级组 ${formatDropStagesSummary(dropSet.dropStages)}`;
    }
    return done
      .map(formatWorkoutSetSummary)
      .join(' / ');
  };

  // 显式带入上次：只带同单位、同记录方式的重量；次数继续留空。
  const applyLastLog = (exIdx: number, lastLog: ExerciseLog) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetEx = exercises[exIdx];
    targetEx.sets.forEach((s, idx) => {
      const mode: WorkoutSetMode = s.isDropSet ? 'drop' : s.unilateral ? 'unilateral' : 'standard';
      const candidates = lastLog.sets.filter(set =>
        set.completed && seedWeightsOnly(set, s.unit, mode) !== null,
      );
      const copied = seedWeightsOnly(candidates[idx] || candidates[candidates.length - 1], s.unit, mode);
      if (!copied) return;
      s.weightOrPlates = copied.weightOrPlates;
      s.reps = 0;
      s.left = copied.left;
      s.right = copied.right;
      s.dropStages = copied.dropStages?.map((stage, stageIndex) => ({
        ...stage,
        id: s.dropStages?.[stageIndex]?.id || `${s.id}-stage-${stageIndex + 1}`,
      }));
    });
    updateActiveSession({ ...activeSession, exercises });
  };

  // 将当前正在录入的大组重量复制到后续未完成大组；次数保持不变。
  const copyDropWeightsToOpenSets = (exIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const sets = exercises[exIndex].sets;
    const sourceIndex = sets.findIndex(set => !set.completed);
    if (sourceIndex < 0) return;
    const source = sets[sourceIndex];
    if (!source.dropStages?.length || !requiresWeightInput(source.unit)) return;

    sets.forEach((set, index) => {
      if (index === sourceIndex || set.completed || !set.dropStages?.length || set.unit !== source.unit) return;
      set.dropStages = set.dropStages.map((stage, stageIndex) => ({
        ...stage,
        weightOrPlates: source.dropStages?.[stageIndex]?.weightOrPlates ?? stage.weightOrPlates,
      }));
      set.weightOrPlates = set.dropStages[0]?.weightOrPlates ?? 0;
    });
    updateActiveSession({ ...activeSession, exercises });
  };

  // 聚焦动作索引钳制
  const safeFocusIdx = activeSession && activeSession.exercises.length > 0
    ? Math.max(0, Math.min(focusIdx, activeSession.exercises.length - 1))
    : 0;
  const focusEx = activeSession?.exercises[safeFocusIdx];
  const focusCat = focusEx ? (CATEGORY_LABELS[focusEx.category] || CATEGORY_LABELS.chest) : null;
  const focusLastLog = focusEx ? (lastLogMap.get(focusEx.exerciseId) || null) : null;
  const progressPct = totalAllSets > 0 ? Math.round((totalCompletedSets / totalAllSets) * 100) : 0;

  // 普通组行（整行可点，44px 大触控）
  const renderSetRow = (exIdx: number, set: WorkoutSet, setIdx: number) => {
    const isPlates = set.unit === 'plates';
    const showWeight = requiresWeightInput(set.unit);
    const firstOpen = activeSession?.exercises[exIdx]?.sets.findIndex(s => !s.completed) ?? -1;
    const isCurrent = !set.completed && firstOpen === setIdx;
    const error = setCompletionErrors[set.id];
    return (
      <div key={set.id} className="space-y-1">
        <div
          onClick={() => toggleSetComplete(exIdx, setIdx)}
          className={cx(
            'relative grid h-14 items-center gap-2 rounded-ctl border px-2 transition-colors',
            showWeight ? 'grid-cols-[32px_1fr_64px_44px]' : 'grid-cols-[32px_1fr_44px]',
            set.completed
              ? 'border-line bg-surface-done'
              : isCurrent
                ? 'border-accent-line bg-accent-soft'
                : 'border-line bg-surface',
          )}
        >
          {isCurrent && (
            <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />
          )}
          <span
            className={cx(
              'flex h-7 w-7 items-center justify-center justify-self-center rounded-[8px] text-sm2 font-semibold tabular-nums',
              set.completed
                ? 'bg-success-soft text-success'
                : isCurrent
                  ? 'bg-accent text-white'
                  : 'bg-surface-subtle text-ink-2',
            )}
          >
            {set.setNumber}
          </span>
          {showWeight && (
            <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="减少重量"
                onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? -1 : -2.5)}
                className="flex h-11 w-10 items-center justify-center rounded-[8px] border border-line bg-surface text-[18px] font-medium text-ink active:bg-surface-strong"
              >
                −
              </button>
              <input
                type="number"
                inputMode="decimal"
                aria-label="重量"
                value={set.weightOrPlates || ''}
                onChange={(e) => setDirectVal(exIdx, setIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
                className={cx(
                  'w-[52px] bg-transparent text-center text-[20px] font-semibold tabular-nums text-ink focus:outline-none',
                  set.completed && 'text-ink-2',
                )}
              />
              <button
                type="button"
                aria-label="增加重量"
                onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? 1 : 2.5)}
                className="flex h-11 w-10 items-center justify-center rounded-[8px] border border-line bg-surface text-[18px] font-medium text-ink active:bg-surface-strong"
              >
                ＋
              </button>
            </div>
          )}
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="number"
              inputMode="numeric"
              aria-label="次数"
              value={set.reps || ''}
              onChange={(e) => setDirectVal(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
              className="h-11 w-full rounded-[8px] bg-surface-subtle text-center text-[17px] font-semibold tabular-nums text-ink focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="button"
            aria-label={set.completed ? `取消完成第 ${set.setNumber} 组` : `完成第 ${set.setNumber} 组`}
            onClick={(e) => { e.stopPropagation(); toggleSetComplete(exIdx, setIdx); }}
            className={cx(
              'flex h-11 w-11 items-center justify-center justify-self-center rounded-full border transition-colors',
              set.completed
                ? 'border-success bg-success text-white'
                : 'border-line-strong bg-surface text-line-strong',
            )}
          >
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
        {error && <p role="alert" className="px-2 text-cap font-semibold text-danger">{error}</p>}
      </div>
    );
  };

  // 左右独立普通组行：每侧只保留重量步进，次数作为可点胶囊字段
  const renderUnilateralSetRow = (exIdx: number, set: WorkoutSet, setIdx: number) => {
    const step = set.unit === 'plates' ? 1 : 2.5;
    const showWeight = requiresWeightInput(set.unit);
    const firstOpen = activeSession?.exercises[exIdx]?.sets.findIndex(s => !s.completed) ?? -1;
    const isCurrent = !set.completed && firstOpen === setIdx;
    const error = setCompletionErrors[set.id];
    const sideBlock = (side: 'left' | 'right') => {
      const label = side === 'left' ? '左' : '右';
      const data: UnilateralSide = set[side] || { weight: set.weightOrPlates, reps: set.reps };
      return (
        <div className="flex min-w-0 items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {showWeight && (
            <button
              type="button"
              aria-label={`${label}侧减少重量`}
              onClick={() => updateUnilateralField(exIdx, setIdx, side, 'weight', -step)}
              className="relative flex h-[38px] w-7 shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-[16px] font-medium text-ink after:absolute after:-inset-[3px] after:content-[''] active:bg-surface-strong"
            >
              −
            </button>
          )}
          <div className="flex min-w-[44px] flex-col items-center">
            {showWeight && (
              <input
                type="number"
                inputMode="decimal"
                aria-label={`${label}侧重量`}
                value={data.weight || ''}
                onChange={(e) => setUnilateralDirectVal(exIdx, setIdx, side, 'weight', parseFloat(e.target.value) || 0)}
                className={cx(
                  'w-11 bg-transparent text-center text-[16px] font-semibold tabular-nums text-ink focus:outline-none',
                  set.completed && 'text-ink-2',
                )}
              />
            )}
            <span
              className={cx(
                'mt-0.5 inline-flex items-center gap-0.5 rounded-[6px] px-1 py-0.5',
                isCurrent ? 'bg-surface' : 'bg-surface-subtle',
              )}
            >
              <input
                type="number"
                inputMode="numeric"
                aria-label={`${label}侧次数`}
                value={data.reps || ''}
                onChange={(e) => setUnilateralDirectVal(exIdx, setIdx, side, 'reps', parseInt(e.target.value) || 0)}
                className="w-6 bg-transparent text-center text-cap font-medium tabular-nums text-ink-3 focus:outline-none"
              />
              <span className="text-cap font-medium text-ink-3">次</span>
            </span>
          </div>
          {showWeight && (
            <button
              type="button"
              aria-label={`${label}侧增加重量`}
              onClick={() => updateUnilateralField(exIdx, setIdx, side, 'weight', step)}
              className="relative flex h-[38px] w-7 shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-[16px] font-medium text-ink after:absolute after:-inset-[3px] after:content-[''] active:bg-surface-strong"
            >
              ＋
            </button>
          )}
        </div>
      );
    };

    return (
      <div key={set.id} className="space-y-1">
        <div
          onClick={() => toggleSetComplete(exIdx, setIdx)}
          className={cx(
            'relative grid min-h-[58px] grid-cols-[26px_1fr_1px_1fr_44px] items-center gap-1.5 rounded-ctl border px-2 transition-colors',
            set.completed
              ? 'border-line bg-surface-done'
              : isCurrent
                ? 'border-accent-line bg-accent-soft'
                : 'border-line bg-surface',
          )}
        >
          {isCurrent && (
            <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />
          )}
          <span
            className={cx(
              'flex h-[26px] w-[26px] items-center justify-center justify-self-center rounded-[8px] text-sm2 font-semibold tabular-nums',
              set.completed
                ? 'bg-success-soft text-success'
                : isCurrent
                  ? 'bg-accent text-white'
                  : 'bg-surface-subtle text-ink-2',
            )}
          >
            {set.setNumber}
          </span>
          {sideBlock('left')}
          <span aria-hidden="true" className="h-7 w-px justify-self-center bg-line" />
          {sideBlock('right')}
          <button
            type="button"
            aria-label={set.completed ? `取消完成第 ${set.setNumber} 组` : `完成第 ${set.setNumber} 组`}
            onClick={(e) => { e.stopPropagation(); toggleSetComplete(exIdx, setIdx); }}
            className={cx(
              'flex h-11 w-11 items-center justify-center justify-self-center rounded-full border transition-colors',
              set.completed
                ? 'border-success bg-success text-white'
                : 'border-line-strong bg-surface text-line-strong',
            )}
          >
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
        {error && <p role="alert" className="px-2 text-cap font-semibold text-danger">{error}</p>}
      </div>
    );
  };

  // 超级组大组（默认折叠一行摘要）
  const renderDropBigSet = (exIdx: number, bigSet: WorkoutSet, setIdx: number) => {
    const stages = bigSet.dropStages || [];
    const expanded = expandedDropSets.has(bigSet.id);
    const showWeight = requiresWeightInput(bigSet.unit);
    const summary = formatDropStagesSummary(stages);
    const firstOpen = activeSession?.exercises[exIdx]?.sets.findIndex(s => !s.completed) ?? -1;
    const isCurrent = !bigSet.completed && firstOpen === setIdx;
    const error = setCompletionErrors[bigSet.id];
    return (
      <div
        key={bigSet.id}
        className={cx(
          'overflow-hidden rounded-ctl border bg-surface',
          bigSet.completed
            ? 'border-line bg-surface-done'
            : isCurrent
              ? 'border-accent-line'
              : 'border-line',
        )}
      >
        {/* 折叠态：一行摘要，可点展开 */}
        <div
          onClick={() => toggleDropSetExpanded(bigSet.id)}
          className={cx(
            'flex h-14 cursor-pointer select-none items-center gap-2 px-3',
            isCurrent && 'bg-accent-soft',
          )}
        >
          <span className="shrink-0 text-sm font-semibold text-ink">
            大组 {bigSet.setNumber}
            <span className="ml-1 text-cap font-normal text-ink-3">{stages.length} 阶</span>
          </span>
          {isCurrent && <Badge tone="accent">进行中</Badge>}
          <span className="min-w-0 flex-1 truncate text-sm2 tabular-nums text-ink-2">
            {summary || '暂无阶梯'}
          </span>
          <button
            type="button"
            aria-label={bigSet.completed ? `取消完成第 ${bigSet.setNumber} 大组` : `完成第 ${bigSet.setNumber} 大组`}
            onClick={(e) => { e.stopPropagation(); toggleSetComplete(exIdx, setIdx); }}
            className={cx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors',
              bigSet.completed
                ? 'border-success bg-success text-white'
                : 'border-line-strong bg-surface text-line-strong',
            )}
          >
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
          {expanded
            ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-3" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />}
        </div>

        {/* 展开态：每个阶梯的重量与次数都是可点输入 */}
        {expanded && (
          <div className="border-t border-line animate-card-in">
            {stages.map((stage, stageIdx) => (
              <div
                key={stage.id}
                className="flex min-h-12 items-center gap-2 border-t border-line px-3 py-1 first:border-t-0"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-surface-subtle text-cap font-semibold text-ink-3">
                  {stageIdx + 1}
                </span>
                {showWeight && (
                  <>
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label={`第 ${stageIdx + 1} 阶重量`}
                      value={stage.weightOrPlates || ''}
                      onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
                      className="h-10 w-14 rounded-[6px] border border-line bg-surface px-1 text-center text-h2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
                    />
                    <span className="text-sm2 text-ink-2">
                      {stage.unit === 'plates' ? '片' : stage.unit === 'assisted' ? 'kg助力' : 'kg'}
                    </span>
                  </>
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`第 ${stageIdx + 1} 阶次数`}
                  value={stage.reps || ''}
                  onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'reps', parseInt(e.target.value) || 0)}
                  className="h-10 w-10 rounded-[6px] border border-line bg-surface px-1 text-center text-sm2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
                />
                <span className="text-sm2 text-ink-2">次</span>
                {stages.length > 1 && (
                  <IconButton
                    label={`删除第 ${stageIdx + 1} 阶`}
                    onClick={() => removeDropStageFromSet(exIdx, setIdx, stageIdx)}
                    className="ml-auto h-10 w-10 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addDropStageToSet(exIdx, setIdx)}
              className="flex h-11 w-full items-center gap-1 px-3 text-sm2 font-semibold text-accent"
            >
              <Plus className="h-4 w-4" /> 加一个递减重量
            </button>
          </div>
        )}
        {error && <p role="alert" className="border-t border-line px-3 py-2 text-cap font-semibold text-danger">{error}</p>}
      </div>
    );
  };

  // 聚焦动作卡片
  const renderFocusCard = () => {
    if (!activeSession || !focusEx || !focusCat) {
      return (
        <Card className="mt-3 p-8 text-center">
          <p className="text-body text-ink-2">还没有动作，从动作库添加第一个动作开始</p>
          <Button variant="primary" size="lg" className="mt-4" onClick={openAddExerciseSheet}>
            <Plus className="h-4 w-4" /> 添加动作
          </Button>
        </Card>
      );
    }
    const exIdx = safeFocusIdx;
    const isDrop = focusEx.sets.some(s => s.isDropSet);
    // 单侧仅做普通组，isDropSet 为真一律按超级组渲染
    const isUnilateralEx = Boolean(focusEx.isUnilateral) && !isDrop;
    const summary = lastLogSummary(focusLastLog, focusEx);
    const latestOpenDropIdx = focusEx.sets.findIndex(set => !set.completed);
    const canCopyDropWeights = isDrop
      && latestOpenDropIdx >= 0
      && requiresWeightInput(focusEx.currentUnit)
      && focusEx.sets.some((set, index) => index > latestOpenDropIdx && !set.completed);
    return (
      <Card key={focusEx.exerciseId + '-' + exIdx} className="mt-3 p-4 animate-card-in">
        {/* 头部：动作名 + 类别 + 规格胶囊 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-h2 font-semibold text-ink">{focusEx.exerciseName}</h3>
              <Badge>{focusCat.label}</Badge>
              {isDrop && (
                <Badge>
                  <Flame className="h-3 w-3" />超级组
                </Badge>
              )}
              {isUnilateralEx && <Badge>左右独立</Badge>}
            </div>
            <button
              type="button"
              onClick={() => setSpecExIdx(exIdx)}
              title="编辑单位、滑轮与记录方式"
              className="mt-2 inline-flex h-6 items-center gap-1 rounded-full bg-surface-subtle px-2 text-cap font-semibold text-ink-2"
            >
              <Pencil className="h-3 w-3" />
              自定义编辑
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <IconButton label="移除动作" tone="danger" onClick={() => removeExercise(exIdx)}>
            <Trash2 className="h-[18px] w-[18px]" />
          </IconButton>
        </div>

        {/* 上次参考一行 */}
        {summary && focusLastLog && (
          <div className="mt-3 flex min-h-12 items-center justify-between gap-2 rounded-ctl bg-surface-subtle px-3 py-2 text-sm2 text-ink-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <span className="truncate">上次：{summary}</span>
            </div>
            <button
              type="button"
              onClick={() => applyLastLog(exIdx, focusLastLog)}
              className="h-11 shrink-0 rounded-[6px] px-2 text-sm2 font-semibold text-accent"
            >
              带入
            </button>
          </div>
        )}

        {/* 组列表 */}
        <div className="mt-4">
          {isDrop ? (
            <div className="space-y-2">
              {canCopyDropWeights && (
                <button
                  type="button"
                  onClick={() => copyDropWeightsToOpenSets(exIdx)}
                  className="flex h-11 w-full items-center justify-center rounded-ctl border border-dashed border-line-strong text-cap font-semibold text-accent"
                >
                  复制第 {latestOpenDropIdx + 1} 大组重量到后续未完成组
                </button>
              )}
              {focusEx.sets.map((bigSet, setIdx) => renderDropBigSet(exIdx, bigSet, setIdx))}
            </div>
          ) : isUnilateralEx ? (
            <>
              <div className="mb-1.5 grid grid-cols-[26px_1fr_1px_1fr_44px] items-center gap-1.5 px-2 text-center text-cap font-semibold text-ink-3">
                <span>组</span>
                <span>左</span>
                <span />
                <span>右</span>
                <span>✓</span>
              </div>
              <div className="space-y-2">
                {focusEx.sets.map((set, setIdx) => renderUnilateralSetRow(exIdx, set, setIdx))}
              </div>
            </>
          ) : (
            <>
              <div className={cx(
                'mb-1.5 grid items-center gap-2 px-2 text-center text-cap font-semibold text-ink-3',
                requiresWeightInput(focusEx.currentUnit) ? 'grid-cols-[32px_1fr_64px_44px]' : 'grid-cols-[32px_1fr_44px]',
              )}>
                <span>组</span>
                {requiresWeightInput(focusEx.currentUnit) && <span>{UNIT_LABELS[focusEx.currentUnit] || '负荷'}</span>}
                <span>次</span>
                <span />
              </div>
              <div className="space-y-2">
                {focusEx.sets.map((set, setIdx) => renderSetRow(exIdx, set, setIdx))}
              </div>
            </>
          )}
        </div>

        {/* 加组 / 删组 */}
        <div className="mt-3 flex items-center justify-between">
          <Button variant="secondary" onClick={() => addSetToExercise(exIdx)}>
            <Plus className="h-4 w-4" /> {isDrop ? '加一大组' : '加一组'}
          </Button>
          {focusEx.sets.length > 1 && (
            <button
              type="button"
              onClick={() => removeSet(exIdx, focusEx.sets.length - 1)}
              className="h-11 px-2 text-sm2 text-ink-3 hover:text-danger"
            >
              {isDrop ? '删除末尾大组' : '删除末尾组'}
            </button>
          )}
        </div>

        {/* 动作切换 */}
        <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setFocusIdx(i => Math.max(0, i - 1))}
            disabled={exIdx === 0}
            className="flex h-11 items-center gap-1 px-2 text-body font-semibold text-accent disabled:text-ink-disabled"
          >
            <ChevronLeft className="h-4 w-4" /> 上一个
          </button>
          <NumberText size="sm" className="text-ink-3">
            {exIdx + 1} / {activeSession.exercises.length}
          </NumberText>
          <button
            type="button"
            onClick={() => setFocusIdx(i => Math.min(activeSession.exercises.length - 1, i + 1))}
            disabled={exIdx === activeSession.exercises.length - 1}
            className="flex h-11 items-center gap-1 px-2 text-body font-semibold text-accent disabled:text-ink-disabled"
          >
            下一个 <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="pb-28 pt-2">
      {!activeSession ? (
        <>
          {/* 头部 */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-cap font-semibold tracking-[0.04em] text-ink-3">
              <span>FITCUSTOM PRO</span>
              <span className="flex items-center gap-1">
                <span>
                  {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  {' '}
                  {new Date().toLocaleDateString('zh-CN', { weekday: 'short' })}
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  aria-label="打开设置"
                  title="设置"
                  className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-surface-subtle hover:text-ink"
                >
                  <SettingsIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </span>
            </div>
            <h1 className="mt-0.5 text-h1 font-bold tracking-tight text-ink">今日训练</h1>
            {renderCompass()}
          </div>

          {/* 今日休息日状态横幅 */}
          {todayRestSession && (
            <Card className="mb-3 flex items-center justify-between gap-3 border-warning/30 p-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                  <Coffee className="h-4 w-4" />
                </span>
                <span className="text-body font-semibold text-ink">今日已安排完全休息</span>
              </div>
              <button
                type="button"
                onClick={() => handleCancelRestDay(todayRestSession.id)}
                className="h-11 shrink-0 px-1 text-sm2 font-semibold text-ink-3 underline hover:text-danger"
              >
                取消重新开练
              </button>
            </Card>
          )}

          {/* 今日状态卡：开练 / 休息 / 补签 */}
          <Card className="p-4">
            <SegmentedControl
              label="今日状态"
              value={statusCardTab}
              onChange={setStatusCardTab}
              options={statusOptions}
            />

            {statusCardTab === 'train' && (
              <div className="animate-card-in">
                <div className="mt-4 flex items-center justify-between gap-2">
                  <h2 className="text-body font-semibold text-ink">选择分化计划开练</h2>
                  <button
                    type="button"
                    onClick={onOpenPlansTab}
                    className="h-8 text-sm2 font-semibold text-accent"
                  >
                    管理全部计划 →
                  </button>
                </div>
                <div>
                  {plans.map((plan) => {
                    const suggested = suggestedPlanId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => startPlan(plan)}
                        className={cx(
                          'relative flex w-full items-center gap-3 border-t border-line py-3.5 text-left first:border-t-0',
                          suggested && 'pl-3',
                        )}
                      >
                        {suggested && (
                          <span aria-hidden="true" className="absolute bottom-4 left-0 top-4 w-0.5 rounded-full bg-accent" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[16px] font-semibold text-ink">{displayPlanName(plan.name)}</span>
                            {suggested && <Badge tone="accent">今日建议</Badge>}
                            {plan.name.includes('腿') && <Badge>下肢专注</Badge>}
                          </span>
                          <span className="mt-0.5 block truncate text-sm2 text-ink-2">{plan.description}</span>
                          <span className="mt-1 block text-cap text-ink-3">
                            {plan.exercises.length} 个动作 · {plan.cardioMinutes ? `有氧 ${plan.cardioMinutes}m` : '无有氧'}
                          </span>
                        </span>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-2">
                          <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {settings.showFreeWorkout && (
                  <button
                    type="button"
                    onClick={startFreeWorkout}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-ctl border border-dashed border-line-strong bg-transparent text-body font-medium text-ink-2 hover:bg-surface-subtle"
                  >
                    <Plus className="h-4 w-4" /> 自由训练（不选预设计划）
                  </button>
                )}
              </div>
            )}

            {statusCardTab === 'rest' && (
              <div className="animate-card-in py-5 text-center">
                {todayRestSession ? (
                  <p className="text-body font-semibold text-ink">今日已安排完全休息，好好恢复</p>
                ) : settings.autoRest ? (
                  <>
                    <p className="text-body font-semibold text-ink">未训练自动休息已开启</p>
                    <p className="mt-1 text-sm2 leading-relaxed text-ink-2">
                      今天不练也不用打卡；明天会自动记为休息日。
                    </p>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="mt-2 h-11 px-2 text-sm2 font-semibold text-accent underline"
                    >
                      去设置
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm2 text-ink-2">今天不练？一键打卡完全休息，串联训练周期</p>
                    <Button variant="outline" className="mt-3" onClick={handleLogRestDay}>
                      <Coffee className="h-4 w-4 text-warning" /> 今日完全休息
                    </Button>
                  </>
                )}
              </div>
            )}

            {statusCardTab === 'backfill' && settings.showBackfill && !settings.autoRest && (
              <div className="animate-card-in pt-4">
                <p className="text-sm2 text-ink-2">之前漏打卡了？选择过去某天补上休息记录</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="date"
                    value={backfillDate}
                    max={yesterdayLocalDate()}
                    onChange={(e) => { setBackfillDate(e.target.value); setBackfillMsg(null); }}
                    className={cx(fieldCls, 'min-w-0 flex-1')}
                  />
                  <Button variant="outline" onClick={handleBackfillRestDay} className="shrink-0">
                    <Coffee className="h-4 w-4 text-warning" /> 补签休息
                  </Button>
                </div>
                {backfillMsg && (
                  <p className="mt-2 rounded-ctl bg-warning-soft px-3 py-2 text-cap font-semibold text-warning">
                    {backfillMsg}
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* 专注模式顶部：细进度条 + 罗盘 */}
          <div className="sticky top-0 z-40 mb-3 border-b border-line bg-surface/95 px-1 pb-2 pt-1 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 text-body font-semibold">
              {isEditingPlanName ? (
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <input
                    type="text"
                    value={displayPlanName(activeSession.planName)}
                    onChange={(e) => updateActiveSession({ ...activeSession, planName: e.target.value })}
                    onBlur={() => setIsEditingPlanName(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingPlanName(false); }}
                    autoFocus
                    placeholder="输入训练名称..."
                    className="h-9 w-full min-w-0 rounded-[6px] border border-accent bg-surface-subtle px-2 text-body font-semibold text-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPlanName(false)}
                    className="h-9 shrink-0 rounded-[6px] px-2 text-sm2 font-semibold text-accent"
                  >
                    完成
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPlanName(true)}
                  className="flex min-w-0 items-center gap-1.5 text-left"
                  title="点击修改本次训练名称"
                >
                  <span className="truncate font-semibold text-ink">{displayPlanName(activeSession.planName)}</span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                  <span className="shrink-0 text-cap font-normal text-ink-3">专注模式</span>
                </button>
              )}
              <NumberText size="sm" className="shrink-0 text-ink-2">
                {totalCompletedSets} / {totalAllSets} 组
              </NumberText>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-strong">
              <div className="h-full rounded-full bg-accent progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            {renderCompass(true)}
          </div>

          <div className="space-y-3 pb-28">
            {renderFocusCard()}

            {/* 添加动作入口 */}
            <button
              type="button"
              onClick={openAddExerciseSheet}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-transparent text-body font-medium text-ink-2 hover:bg-surface-subtle"
            >
              <Plus className="h-4 w-4 text-ink-2" /> 从动作库添加动作
            </button>

            {/* 有氧折叠行：所有训练均可用，由用户手动开启；可在设置里隐藏入口 */}
            {settings.showCardio && (
            <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCardio(v => !v)}
                  className="flex h-14 w-full items-center justify-between px-4 text-left"
                >
                  <span className="flex items-center gap-2 text-body font-semibold text-ink">
                    <Flame className="h-4 w-4 text-ink-3" /> 有氧
                    <span className="text-sm2 font-normal text-ink-3">
                      {activeSession.cardioCompleted
                        ? `${activeSession.cardioMinutes || 20}分钟${activeSession.cardioType ? ` · ${activeSession.cardioType}` : ''}`
                        : '无有氧'}
                    </span>
                  </span>
                  {showCardio
                    ? <ChevronUp className="h-4 w-4 text-ink-3" />
                    : <ChevronDown className="h-4 w-4 text-ink-3" />}
                </button>
                {showCardio && (
                  <div className="space-y-3 border-t border-line px-4 pb-4 pt-3 animate-card-in">
                    <SegmentedControl
                      label="有氧安排"
                      value={activeSession.cardioCompleted ? 'yes' : 'none'}
                      onChange={(value) => setCardioMode(value === 'yes')}
                      options={CARDIO_MODE_OPTIONS}
                    />
                    {activeSession.cardioCompleted && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-sm2 text-ink-2">时长</span>
                          <input
                            type="number"
                            min={1}
                            max={300}
                            inputMode="numeric"
                            value={activeSession.cardioMinutes || ''}
                            onChange={(e) => setCardioMinutes(parseInt(e.target.value) || 0)}
                            className="h-11 w-20 rounded-ctl border border-line bg-surface-subtle px-2 text-center text-body font-semibold tabular-nums text-ink focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                          />
                          <span className="text-sm2 text-ink-2">分钟</span>
                          <div className="ml-auto flex gap-1">
                            {[15, 20, 30].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setCardioMinutes(mins)}
                                className={cx(
                                  'h-11 rounded-[8px] px-2.5 text-cap font-semibold',
                                  activeSession.cardioMinutes === mins
                                    ? 'bg-ink text-white'
                                    : 'bg-surface-subtle text-ink-2',
                                )}
                              >
                                {mins}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={activeSession.cardioType || ''}
                          onChange={(e) => updateActiveSession({ ...activeSession, cardioType: e.target.value })}
                          placeholder="有氧类型，例如：跑步机坡度快走"
                          aria-label="有氧类型"
                          className={fieldCls}
                        />
                        <input
                          type="text"
                          value={activeSession.cardioNotes || ''}
                          onChange={(e) => updateActiveSession({ ...activeSession, cardioNotes: e.target.value })}
                          placeholder="例如: 跑步机坡度 10，速度 5.0 km/h 快走"
                          className={fieldCls}
                        />
                      </>
                    )}
                  </div>
                )}
            </Card>
            )}

            {/* 备注：设置关闭时只读展示已有内容 */}
            {settings.showNotes ? (
              <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowNotes(v => !v)}
                  className="flex h-14 w-full items-center justify-between px-4 text-left"
                >
                  <span className="text-body font-semibold text-ink-3">
                    训练备注 <span className="text-sm2 font-normal">{activeSession.notes ? '' : '（点开展开）'}</span>
                  </span>
                  {showNotes
                    ? <ChevronUp className="h-4 w-4 text-ink-3" />
                    : <ChevronDown className="h-4 w-4 text-ink-3" />}
                </button>
                {showNotes && (
                  <div className="border-t border-line px-4 pb-4 pt-3 animate-card-in">
                    <textarea
                      rows={2}
                      value={activeSession.notes || ''}
                      onChange={(e) => updateActiveSession({ ...activeSession, notes: e.target.value })}
                      placeholder="记录今日力量状态、器械手感、酸痛度等..."
                      className="w-full rounded-ctl border border-line bg-surface-subtle p-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                    />
                  </div>
                )}
              </Card>
            ) : activeSession.notes ? (
              <Card className="p-4">
                <p className="text-cap font-semibold text-ink-3">训练备注（只读）</p>
                <p className="mt-1 whitespace-pre-wrap text-sm2 leading-relaxed text-ink-2">{activeSession.notes}</p>
              </Card>
            ) : null}

            {/* 放弃训练 */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleAbandonSession}
                className="h-11 px-2 text-sm2 text-ink-3 underline hover:text-danger"
              >
                放弃本次训练
              </button>
            </div>
          </div>

          {/* 悬浮结束钮：外圈显示完成进度 */}
          <div
            className="fixed bottom-6 right-4 z-40 h-[70px] w-[70px] rounded-full p-[3px]"
            style={{ background: `conic-gradient(rgb(var(--c-success)) ${progressPct}%, rgb(var(--c-surface-strong)) 0)` }}
          >
            <button
              type="button"
              aria-label="结束训练"
              onClick={() => {
                setFinishError(null);
                setShowFinishModal(true);
              }}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-ink text-white shadow-modal active:scale-95"
            >
              <span className="text-cap font-semibold leading-tight">结束</span>
              <span className="text-cap font-semibold leading-tight tabular-nums">{totalCompletedSets}/{totalAllSets}</span>
            </button>
          </div>
        </>
      )}

      {/* 规格抽屉：单位 + 滑轮 + 记录方式 */}
      <Sheet
        open={specExIdx !== null}
        onClose={() => setSpecExIdx(null)}
        title="动作规格"
        description={
          specExIdx !== null && activeSession
            ? activeSession.exercises[specExIdx]?.exerciseName
            : undefined
        }
        footer={
          <Button variant="primary" size="lg" block onClick={() => setSpecExIdx(null)}>
            完成
          </Button>
        }
      >
        {specExIdx !== null && activeSession && activeSession.exercises[specExIdx] && (() => {
          const specEx = activeSession.exercises[specExIdx];
          const isDrop = specEx.sets.some(s => s.isDropSet);
          const isUni = Boolean(specEx.isUnilateral) && !isDrop;
          const pulleyEnabled = specEx.currentUnit !== 'bodyweight' && specEx.pulleyRatio !== 'none';
          return (
            <div>
              <p className="mb-1.5 text-cap font-semibold text-ink-3">计量单位</p>
              <SegmentedControl
                label="计量单位"
                value={specEx.currentUnit}
                onChange={(unit) => changeExerciseUnit(specExIdx, unit)}
                options={UNIT_OPTIONS}
              />

              {specEx.currentUnit !== 'bodyweight' && (
                <div className="mt-4 rounded-ctl border border-line bg-surface-subtle p-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm2 font-semibold text-ink">滑轮记录</span>
                      <span className="block text-cap text-ink-3">可选高级项，默认不记录</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={pulleyEnabled}
                      onChange={(e) => changePulleyRatio(specExIdx, e.target.checked ? '1:1' : 'none')}
                      className="h-5 w-5 accent-accent"
                    />
                  </label>
                  {pulleyEnabled && (
                    <div className="mt-2">
                      <SegmentedControl
                        label="滑轮比例"
                        value={specEx.pulleyRatio === '2:1' ? '2:1' : '1:1'}
                        onChange={(ratio) => changePulleyRatio(specExIdx, ratio)}
                        options={PULLEY_OPTIONS}
                      />
                    </div>
                  )}
                </div>
              )}

              {(settings.showUnilateral || isUni) && (
                <>
                  <p className="mb-1.5 mt-4 text-cap font-semibold text-ink-3">记录方式</p>
                  <SegmentedControl
                    label="记录方式"
                    value={isUni ? 'unilateral' : 'both'}
                    onChange={(mode) => changeRecordMode(specExIdx, mode === 'unilateral', false)}
                    options={settings.showUnilateral ? RECORD_MODE_OPTIONS : RECORD_MODE_OPTIONS.filter(o => o.value !== 'unilateral')}
                    disabled={isDrop}
                  />
                  {isDrop ? (
                    <p className="mt-2 text-cap text-ink-3">超级组按大组记录，不支持左右分开</p>
                  ) : settings.showUnilateral ? (
                    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm2 text-ink-2">
                      <input
                        type="checkbox"
                        checked={Boolean(specEx.isUnilateral)}
                        onChange={(e) => changeRecordMode(specExIdx, Boolean(specEx.isUnilateral), e.target.checked)}
                        className="h-4 w-4 accent-accent"
                      />
                      同时记住到动作库（以后该动作默认左右分开）
                    </label>
                  ) : null}
                </>
              )}

              {(settings.showDropSets || isDrop) && (
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-ctl border border-line bg-surface px-3">
                  <span className="min-w-0">
                    <span className="block text-sm2 font-semibold text-ink">超级组</span>
                    <span className="block text-cap text-ink-3">把当前组转换为递减阶梯；与左右分开互斥</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isDrop}
                    onChange={(e) => changeExerciseDropMode(specExIdx, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                </label>
              )}
            </div>
          );
        })()}
      </Sheet>

      {/* 添加动作面板：动作库 / 自定义两个标签页 */}
      <Sheet
        open={showAddExModal}
        onClose={() => setShowAddExModal(false)}
        title="添加动作"
        size="lg"
      >
        <SegmentedControl
          label="添加方式"
          value={addSheetTab}
          onChange={setAddSheetTab}
          options={ADD_SHEET_OPTIONS}
        />

        {addSheetTab === 'library' ? (
          <>
            <input
              type="text"
              placeholder="搜索动作名称（如 卧推、深蹲、夹胸）..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="搜索动作"
              className={cx(fieldCls, 'mt-4')}
            />
            <div className="mt-2">
              {allExercises
                .filter(e => !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(e => {
                  const cat = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.chest;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => addExerciseToCurrent(e)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-line px-1 py-2 text-left last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-body font-semibold text-ink">{e.name}</span>
                          <Badge>{cat.label}</Badge>
                          {e.isDropSet && (
                            <Badge>
                              <Flame className="h-3 w-3" />超级组
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-cap text-ink-3">默认: {UNIT_LABELS[e.defaultUnit]}</span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-ink-3" />
                    </button>
                  );
                })}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3 rounded-ctl border border-line bg-surface-subtle/60 p-3 animate-card-in">
            {customError && (
              <p className="rounded-ctl bg-danger-soft px-3 py-2 text-cap font-semibold text-danger">{customError}</p>
            )}
            <div>
              <label className="mb-1 block text-cap font-semibold text-ink-2">动作名称 *</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例如: 史密斯下斜推胸"
                className={fieldCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-cap font-semibold text-ink-2">目标肌肉群</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as MuscleCategory)}
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
                <label className="mb-1 block text-cap font-semibold text-ink-2">计量单位</label>
                <select
                  value={customUnit}
                  onChange={(e) => {
                    setCustomUnit(e.target.value as ResistanceUnit);
                  }}
                  className={fieldCls}
                >
                  <option value="plates">插销 (片)</option>
                  <option value="kg">重量 (kg)</option>
                  <option value="assisted">助力 (kg)</option>
                  <option value="bodyweight">自重</option>
                </select>
              </div>
            </div>
            {(settings.showUnilateral || settings.showDropSets) && (
              <div>
                <p className="mb-1.5 text-cap font-semibold text-ink-3">训练方式</p>
                <div className={cx('grid gap-2', settings.showUnilateral && settings.showDropSets ? 'grid-cols-2' : 'grid-cols-1')}>
                  {settings.showUnilateral && (
                    <button
                      type="button"
                      aria-pressed={customUnilateral}
                      onClick={() => { setCustomUnilateral(v => !v); setCustomDropSet(false); }}
                      className={cx(
                        'flex min-h-16 flex-col items-start justify-center gap-1 rounded-ctl border px-3 py-2 text-left transition-colors',
                        customUnilateral ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                      )}
                    >
                      <span className="flex w-full items-center gap-1.5 text-sm2 font-semibold text-ink">
                        <ArrowLeftRight className={cx('h-4 w-4', customUnilateral ? 'text-accent' : 'text-ink-3')} />
                        左右独立
                        {customUnilateral && <Check className="ml-auto h-4 w-4 text-accent" />}
                      </span>
                      <span className="text-cap text-ink-3">左右分别记录</span>
                    </button>
                  )}
                  {settings.showDropSets && (
                    <button
                      type="button"
                      aria-pressed={customDropSet}
                      onClick={() => { setCustomDropSet(v => !v); setCustomUnilateral(false); }}
                      className={cx(
                        'flex min-h-16 flex-col items-start justify-center gap-1 rounded-ctl border px-3 py-2 text-left transition-colors',
                        customDropSet ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                      )}
                    >
                      <span className="flex w-full items-center gap-1.5 text-sm2 font-semibold text-ink">
                        <Flame className={cx('h-4 w-4', customDropSet ? 'text-accent' : 'text-ink-3')} />
                        超级组
                        {customDropSet && <Check className="ml-auto h-4 w-4 text-accent" />}
                      </span>
                      <span className="text-cap text-ink-3">自动 4 阶递减</span>
                    </button>
                  )}
                </div>
                {settings.showUnilateral && settings.showDropSets && (
                  <p className="mt-1.5 text-cap text-ink-3">两种方式互斥，也可都不选</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCustomName('');
                  setCustomNotes('');
                  setCustomUnilateral(false);
                  setCustomDropSet(false);
                  setCustomError(null);
                }}
              >
                清空
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!customName.trim()) { setCustomError('请输入动作名称'); return; }
                  createAndAddCustomExercise({
                    name: customName, category: customCategory, defaultUnit: customUnit,
                    isUnilateral: customUnilateral,
                    isDropSet: customDropSet,
                    dropStages: customDropSet ? makeDefaultDropStages(customUnit) : undefined,
                    notes: customNotes,
                  });
                  setCustomName(''); setCustomNotes(''); setCustomUnilateral(false);
                  setCustomDropSet(false);
                  setCustomError(null);
                }}
              >
                保存并加入本次训练
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* 完成训练祝贺弹窗 */}
      {showFinishModal && activeSession && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in"
          onClick={() => setShowFinishModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="完成训练"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-sheet bg-surface p-6 text-center shadow-modal animate-sheet-up"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
              <Award className="h-8 w-8" />
            </div>

            <h2 className="text-[20px] font-bold text-ink">本次训练记录</h2>
            <p className="mt-1 text-sm2 text-ink-2">确认已完成的组数与有氧，再保存本次记录</p>

            <div className="my-5 grid grid-cols-3 gap-2 rounded-ctl bg-surface-subtle p-3">
              <div>
                <span className="block text-cap text-ink-3">动作数量</span>
                <span className="block text-body font-semibold tabular-nums text-ink">{activeSession.exercises.length} 个</span>
              </div>
              <div>
                <span className="block text-cap text-ink-3">完成总组数</span>
                <span className="block text-body font-semibold tabular-nums text-success">{totalCompletedSets} 组</span>
              </div>
              <div>
                <span className="block text-cap text-ink-3">有氧燃脂</span>
                <span className="block text-body font-semibold tabular-nums text-ink">
                  {activeSession.cardioCompleted ? `${activeSession.cardioMinutes}m` : '未安排'}
                </span>
              </div>
            </div>

            {/* 完成前最后确认有氧：无有氧 / 有有氧 + 自定义时长；设置隐藏时不显示 */}
            {settings.showCardio && (
            <div className="mb-4 rounded-ctl bg-surface-subtle p-3 text-left">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-cap font-semibold text-ink-3">有氧安排</span>
                <span className="text-sm2 font-semibold text-ink">
                  {activeSession.cardioCompleted ? '有有氧' : '无有氧'}
                </span>
              </div>
              <SegmentedControl
                label="有氧安排"
                value={activeSession.cardioCompleted ? 'yes' : 'none'}
                onChange={(value) => setCardioMode(value === 'yes')}
                options={CARDIO_MODE_OPTIONS}
              />
              {activeSession.cardioCompleted && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={activeSession.cardioType || ''}
                    onChange={(e) => updateActiveSession({ ...activeSession, cardioType: e.target.value })}
                    placeholder="有氧类型"
                    aria-label="有氧类型"
                    className={fieldCls}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      inputMode="numeric"
                      value={activeSession.cardioMinutes || ''}
                      onChange={(e) => setCardioMinutes(parseInt(e.target.value) || 0)}
                      className="h-11 w-20 rounded-ctl border border-line bg-surface px-2 text-center text-body font-semibold tabular-nums text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                    />
                    <span className="text-sm2 text-ink-2">分钟</span>
                    <span className="text-cap text-ink-3">可填 1–300 分钟</span>
                  </div>
                </div>
              )}
            </div>
            )}

            {finishError && (
              <p role="alert" className="mb-3 text-cap font-semibold text-danger">{finishError}</p>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowFinishModal(false)}>
                继续调整
              </Button>
              <Button variant="primary" className="flex-1" onClick={finishSession}>
                确认归档
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 统一确认抽屉（取消休息 / 放弃训练） */}
      <ConfirmSheet
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        danger={confirmState.danger}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
};
