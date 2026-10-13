import { useState, useEffect, useMemo } from 'react';
import {
  Play, Plus, Check, Trash2,
  Dumbbell, Flame,
  Sparkles, Award, Coffee,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  WorkoutPlan, WorkoutSession, ExerciseLog, WorkoutSet,
  ResistanceUnit, PulleyRatio, MuscleCategory, CATEGORY_LABELS, UNIT_LABELS, Exercise,
  UnilateralSide
} from '../types';
import { StorageService } from '../utils/storage';
import { buildSessionFromPlan } from '../utils/sessionBuilder';
import { todayLocalDate, yesterdayLocalDate } from '../utils/date';
import { ConfirmSheet } from './ConfirmSheet';

interface WorkoutViewProps {
  onOpenPlansTab: () => void;
  allExercises: Exercise[];
  onFocusModeChange?: (inFocus: boolean) => void;
  onRefreshExercises?: () => void;
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

// 从计划名/会话名推断所属分化
function classifySession(planName: string, isRestDay?: boolean): CycleKey {
  if (isRestDay) return 'rest';
  if (planName.includes('胸')) return 'chest';
  if (planName.includes('背')) return 'back';
  if (planName.includes('肩')) return 'shoulder';
  if (planName.includes('腿')) return 'leg';
  return 'chest';
}

const UNIT_SHORT: Record<ResistanceUnit, string> = {
  plates: '插销',
  kg: '重量',
  assisted: '助力',
  bodyweight: '自重',
};
const PULLEY_SHORT: Record<PulleyRatio, string> = {
  none: '普通器械',
  '1:1': '单滑轮',
  '2:1': '双滑轮',
};

// 单侧组重量单位短标签
const unitBadge = (u: ResistanceUnit): string =>
  u === 'plates' ? '片' : u === 'assisted' ? '助力kg' : u === 'bodyweight' ? '自重' : 'kg';

export const WorkoutView: React.FC<WorkoutViewProps> = ({
  onOpenPlansTab,
  allExercises,
  onFocusModeChange,
  onRefreshExercises,
}) => {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [showAddExModal, setShowAddExModal] = useState(false);
  // 添加动作弹窗内的自定义动作折叠表单
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<MuscleCategory>('chest');
  const [customUnit, setCustomUnit] = useState<ResistanceUnit>('plates');
  const [customPulley, setCustomPulley] = useState<PulleyRatio>('none');
  const [customUnilateral, setCustomUnilateral] = useState(false);
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
  const [specExIdx, setSpecExIdx] = useState<number | null>(null); // 规格抽屉作用于哪个动作
  const [expandedDropSets, setExpandedDropSets] = useState<Set<string>>(new Set()); // 展开的大组 id
  const [showCardio, setShowCardio] = useState(false);    // 有氧折叠
  const [showNotes, setShowNotes] = useState(false);      // 备注折叠
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; confirmText: string; danger: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmText: '确定', danger: true, onConfirm: () => {} });

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

  // 同步活动状态到本地缓存
  const updateActiveSession = (updated: WorkoutSession | null) => {
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
      cardioMinutes: 20,
      cardioCompleted: false,
      cardioType: '跑步机坡度快走',
    };
    setFocusIdx(0);
    updateActiveSession(newSession);
  };

  // 添加新动作到当前训练
  const addExerciseToCurrent = (exercise: Exercise) => {
    if (!activeSession) return;
    const lastLog = StorageService.getLastExerciseLog(exercise.id);
    const unit = lastLog?.currentUnit || exercise.defaultUnit || 'plates';
    const pulley = lastLog?.pulleyRatio || exercise.defaultPulley || 'none';

    const exIsUnilateral = Boolean(exercise.isUnilateral);

    const defaultSets: WorkoutSet[] = [1, 2, 3, 4].map((num, i) => {
      const lastSet = lastLog?.sets[i];
      const weight = lastSet?.weightOrPlates || (unit === 'plates' ? 8 : 40);
      const reps = lastSet?.reps || 12;
      const newSet: WorkoutSet = {
        id: `s-${Date.now()}-${num}`,
        setNumber: num,
        unit: lastSet?.unit || unit,
        weightOrPlates: weight,
        reps,
        completed: false,
        pulleyRatio: lastSet?.pulleyRatio || pulley
      };
      // 左右独立动作：普通组生成左右两侧默认值（优先沿用上次记录的左右值）
      if (exIsUnilateral) {
        newSet.unilateral = true;
        newSet.left = { weight: lastSet?.left?.weight ?? weight, reps: lastSet?.left?.reps ?? reps };
        newSet.right = { weight: lastSet?.right?.weight ?? weight, reps: lastSet?.right?.reps ?? reps };
      }
      return newSet;
    });

    const newExLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      pulleyRatio: pulley,
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
    targetSet.completed = !targetSet.completed;
    updateActiveSession({ ...activeSession, exercises });
  };

  // 修改组数据
  const updateSetField = (exIndex: number, setIndex: number, field: 'weightOrPlates' | 'reps', delta: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    const currentVal = targetSet[field];
    const nextVal = Math.max(0, currentVal + delta);
    targetSet[field] = nextVal;
    updateActiveSession({ ...activeSession, exercises });
  };

  const setDirectVal = (exIndex: number, setIndex: number, field: 'weightOrPlates' | 'reps', val: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    exercises[exIndex].sets[setIndex][field] = Math.max(0, val);
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
    next[field] = Math.max(0, next[field] + delta);
    targetSet[side] = next;
    targetSet.unilateral = true;
    // 主字段保持左侧副本，兼容未分侧渲染与历史摘要
    if (targetSet.left) {
      targetSet.weightOrPlates = targetSet.left.weight;
      targetSet.reps = targetSet.left.reps;
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
    next[field] = Math.max(0, val);
    targetSet[side] = next;
    targetSet.unilateral = true;
    if (targetSet.left) {
      targetSet.weightOrPlates = targetSet.left.weight;
      targetSet.reps = targetSet.left.reps;
    }
    updateActiveSession({ ...activeSession, exercises });
  };

  // 修改超级组阶梯数值 (某个递减阶段的重量或次数)
  const updateDropStageField = (exIndex: number, setIndex: number, stageIndex: number, field: 'weightOrPlates' | 'reps', delta: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages) return;
    const stg = targetSet.dropStages[stageIndex];
    stg[field] = Math.max(0, stg[field] + delta);
    updateActiveSession({ ...activeSession, exercises });
  };

  const setDropStageDirectVal = (exIndex: number, setIndex: number, stageIndex: number, field: 'weightOrPlates' | 'reps', val: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages) return;
    targetSet.dropStages[stageIndex][field] = Math.max(0, val);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 为某个大组增加一个递减阶梯
  const addDropStageToSet = (exIndex: number, setIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetSet = exercises[exIndex].sets[setIndex];
    if (!targetSet.dropStages) targetSet.dropStages = [];
    const lastStg = targetSet.dropStages[targetSet.dropStages.length - 1];
    const newWeight = lastStg ? Math.max(1, lastStg.weightOrPlates - 2.5) : 5;
    targetSet.dropStages.push({
      id: `stg-${Date.now()}`,
      weightOrPlates: newWeight,
      unit: lastStg ? lastStg.unit : 'kg',
      reps: 10,
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

    const newSet: WorkoutSet = {
      id: `s-${Date.now()}-${ex.sets.length + 1}`,
      setNumber: ex.sets.length + 1,
      unit: lastSet ? lastSet.unit : ex.currentUnit,
      weightOrPlates: lastSet ? lastSet.weightOrPlates : 10,
      reps: lastSet ? lastSet.reps : 12,
      completed: false,
      pulleyRatio: lastSet ? lastSet.pulleyRatio : ex.pulleyRatio,
      isDropSet: isDrop,
      dropStages: isDrop && lastSet?.dropStages ? JSON.parse(JSON.stringify(lastSet.dropStages)) : undefined,
    };
    // 左右独立动作（普通组）：新组沿用上一组的左右值与单位
    if (ex.isUnilateral && !isDrop) {
      newSet.unilateral = true;
      newSet.left = {
        weight: lastSet?.left?.weight ?? newSet.weightOrPlates,
        reps: lastSet?.left?.reps ?? newSet.reps,
      };
      newSet.right = {
        weight: lastSet?.right?.weight ?? newSet.weightOrPlates,
        reps: lastSet?.right?.reps ?? newSet.reps,
      };
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
    exercises[exIndex].currentUnit = newUnit;
    exercises[exIndex].sets.forEach(s => s.unit = newUnit);
    updateActiveSession({ ...activeSession, exercises });
  };

  // 切换滑轮比例（单滑轮 / 双滑轮 / 无）
  const changePulleyRatio = (exIndex: number, ratio: PulleyRatio) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    exercises[exIndex].pulleyRatio = ratio;
    exercises[exIndex].sets.forEach(s => s.pulleyRatio = ratio);
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

  // 在自由训练中新建自定义动作：写入动作库后立即加入本次训练
  const createAndAddCustomExercise = (data: {
    name: string; category: MuscleCategory; defaultUnit: ResistanceUnit;
    defaultPulley: PulleyRatio; isUnilateral: boolean; notes: string;
  }): boolean => {
    if (!activeSession) return false;
    const created = StorageService.addCustomExercise({
      name: data.name.trim(),
      category: data.category,
      defaultUnit: data.defaultUnit,
      defaultPulley: data.defaultPulley,
      isUnilateral: data.isUnilateral || undefined,
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

  // 完成结算
  const finishSession = () => {
    if (!activeSession) return;
    const finalSession: WorkoutSession = {
      ...activeSession,
      endTime: Date.now()
    };
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

  // 检查今日是否已安排休息日（读 state，不再在渲染体里打 localStorage）
  const todayDateStr = todayLocalDate();
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

  // 分化罗盘：从历史记录推断上次分化与建议下次
  const compass = useMemo(() => {
    const nonFree = sessions.filter(s => !s.isRestDay && s.planName !== '自由训练');
    const lastSession = sessions.find(s => s.isRestDay || !s.isRestDay);
    if (!lastSession) return { lastKey: null as CycleKey | null, suggestKey: 'chest' as CycleKey, daysAgo: null as number | null };
    const lastKey = s_isRestCheck(lastSession);
    const lastIdx = CYCLE_ORDER.indexOf(lastKey);
    const suggestKey = CYCLE_ORDER[(lastIdx + 1) % CYCLE_ORDER.length];
    // 距今天数
    const today = new Date(todayDateStr + 'T00:00:00');
    const last = new Date(lastSession.date + 'T00:00:00');
    const daysAgo = Math.max(0, Math.round((today.getTime() - last.getTime()) / 86400000));
    void nonFree;
    return { lastKey, suggestKey, daysAgo };
    function s_isRestCheck(sess: WorkoutSession): CycleKey {
      return classifySession(sess.planName, sess.isRestDay);
    }
  }, [sessions, todayDateStr]);

  // 分化罗盘条
  const renderCompass = () => (
    <div className="flex items-center gap-1 mt-2 overflow-x-auto scrollbar-none text-[10px] font-bold">
      {CYCLE_ORDER.map((key, i) => {
        const isLast = compass.lastKey === key;
        const isSuggest = compass.suggestKey === key;
        return (
          <span key={key} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-slate-300">➔</span>}
            <span
              className={`px-2 py-1 rounded-lg whitespace-nowrap ${
                isSuggest
                  ? 'bg-blue-600 text-white shadow'
                  : isLast
                    ? 'bg-slate-600 text-white'
                    : key === 'rest'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-400'
              }`}
            >
              {CYCLE_LABEL[key]}
              {isLast && compass.daysAgo !== null && compass.daysAgo > 0 && `·${compass.daysAgo}天前`}
              {isLast && compass.daysAgo === 0 && '·今天'}
              {isSuggest && '·建议下次'}
            </span>
          </span>
        );
      })}
    </div>
  );

  // 上次参考一行摘要
  const lastLogSummary = (lastLog: ExerciseLog | null): string | null => {
    if (!lastLog) return null;
    const done = lastLog.sets.filter(s => s.completed);
    if (done.length === 0) return null;
    return done
      .map(s => {
        // 左右独立：分侧展示
        if (s.unilateral && s.left && s.right) {
          return `左${s.left.weight}×${s.left.reps} / 右${s.right.weight}×${s.right.reps}`;
        }
        return `${s.weightOrPlates}${s.unit === 'plates' ? '片' : s.unit === 'assisted' ? '助力' : s.unit === 'bodyweight' ? '自重' : 'kg'}×${s.reps}`;
      })
      .join(' / ');
  };

  // 一键带入上次数据（含左右独立的左右值与单位）
  const applyLastLog = (exIdx: number, lastLog: ExerciseLog) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    const targetEx = exercises[exIdx];
    const exIsUnilateral = Boolean(targetEx.isUnilateral);
    targetEx.sets.forEach((s, idx) => {
      const lastSet = lastLog.sets[idx];
      if (!lastSet) return;
      s.weightOrPlates = lastSet.weightOrPlates;
      s.reps = lastSet.reps;
      s.unit = lastSet.unit;
      // 当前动作或上次记录为左右独立时，同步左右两侧的值与单位
      if (exIsUnilateral || lastSet.unilateral) {
        s.unilateral = true;
        s.left = {
          weight: lastSet.left?.weight ?? lastSet.weightOrPlates,
          reps: lastSet.left?.reps ?? lastSet.reps,
        };
        s.right = {
          weight: lastSet.right?.weight ?? lastSet.weightOrPlates,
          reps: lastSet.right?.reps ?? lastSet.reps,
        };
      }
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
    return (
      <div
        key={set.id}
        onClick={() => toggleSetComplete(exIdx, setIdx)}
        className={`grid grid-cols-12 gap-2 items-center rounded-2xl p-2.5 cursor-pointer border-2 transition-all active:scale-[0.99] ${
          set.completed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="col-span-2 flex items-center justify-center">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
            set.completed ? 'bg-emerald-600 text-white animate-check-pop' : 'bg-slate-200 text-slate-700'
          }`}>
            {set.setNumber}
          </span>
        </div>
        <div
          className="col-span-6 flex items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? -1 : -2.5)}
            className="w-11 h-11 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-black text-lg shadow-xs"
          >
            −
          </button>
          <div className="text-center min-w-0 flex-1">
            <input
              type="number"
              value={set.weightOrPlates || ''}
              onChange={(e) => setDirectVal(exIdx, setIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
              className="w-full min-w-[2.5rem] max-w-[4rem] text-center bg-transparent font-black text-xl text-slate-900 focus:outline-none"
            />
            <div className="text-[10px] text-slate-400 font-semibold -mt-0.5">
              {isPlates ? '片' : set.unit === 'assisted' ? '助力kg' : set.unit === 'bodyweight' ? '自重' : 'kg'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? 1 : 2.5)}
            className="w-11 h-11 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-black text-lg shadow-xs"
          >
            ＋
          </button>
        </div>
        <div
          className="col-span-2 flex items-center justify-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="number"
            value={set.reps || ''}
            onChange={(e) => setDirectVal(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
            className="w-full min-w-[2rem] max-w-[3rem] text-center bg-white border border-slate-200 rounded-xl py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="col-span-2 flex items-center justify-center">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
            set.completed
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 animate-check-pop'
              : 'bg-white text-slate-300 border-2 border-slate-200'
          }`}>
            <Check className="w-5 h-5 stroke-[3]" />
          </span>
        </div>
      </div>
    );
  };

  // 左右独立普通组行：左右各一列，列内重量/次数上下紧凑；整行可点打勾
  const renderUnilateralSetRow = (exIdx: number, set: WorkoutSet, setIdx: number) => {
    const step = set.unit === 'plates' ? 1 : 2.5;
    const sideBlock = (side: 'left' | 'right', label: string) => {
      const data: UnilateralSide = set[side] || { weight: set.weightOrPlates, reps: set.reps };
      return (
        <div className="col-span-4 min-w-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-[9px] font-black text-slate-400 text-center leading-none mb-0.5">{label}</div>
          <div className="flex items-center justify-center gap-0.5 min-w-0">
            <button
              type="button"
              onClick={() => updateUnilateralField(exIdx, setIdx, side, 'weight', -step)}
              className="w-6 h-6 shrink-0 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 rounded-lg flex items-center justify-center font-black text-sm"
            >
              −
            </button>
            <div className="min-w-0 flex-1 text-center">
              <input
                type="number"
                value={data.weight || ''}
                onChange={(e) => setUnilateralDirectVal(exIdx, setIdx, side, 'weight', parseFloat(e.target.value) || 0)}
                className="w-full min-w-0 text-center bg-transparent font-black text-sm text-slate-900 focus:outline-none"
              />
              <div className="text-[9px] text-slate-400 font-semibold leading-none -mt-0.5">{unitBadge(set.unit)}</div>
            </div>
            <button
              type="button"
              onClick={() => updateUnilateralField(exIdx, setIdx, side, 'weight', step)}
              className="w-6 h-6 shrink-0 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 rounded-lg flex items-center justify-center font-black text-sm"
            >
              ＋
            </button>
          </div>
          <input
            type="number"
            value={data.reps || ''}
            onChange={(e) => setUnilateralDirectVal(exIdx, setIdx, side, 'reps', parseInt(e.target.value) || 0)}
            className="w-full min-w-0 mt-0.5 text-center bg-white border border-slate-200 rounded-lg py-1 font-black text-sm text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      );
    };
    return (
      <div
        key={set.id}
        onClick={() => toggleSetComplete(exIdx, setIdx)}
        className={`grid grid-cols-12 gap-1.5 items-center rounded-2xl p-2 cursor-pointer border-2 transition-all active:scale-[0.99] ${
          set.completed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="col-span-2 flex items-center justify-center">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm ${
            set.completed ? 'bg-emerald-600 text-white animate-check-pop' : 'bg-slate-200 text-slate-700'
          }`}>
            {set.setNumber}
          </span>
        </div>
        {sideBlock('left', '左')}
        {sideBlock('right', '右')}
        <div className="col-span-2 flex items-center justify-center">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            set.completed
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 animate-check-pop'
              : 'bg-white text-slate-300 border-2 border-slate-200'
          }`}>
            <Check className="w-4 h-4 stroke-[3]" />
          </span>
        </div>
      </div>
    );
  };

  // 超级组大组（默认折叠一行摘要）
  const renderDropBigSet = (exIdx: number, bigSet: WorkoutSet, setIdx: number) => {
    const stages = bigSet.dropStages || [];
    const expanded = expandedDropSets.has(bigSet.id);
    const summary = stages.map(st => `${st.weightOrPlates}×${st.reps}`).join(' ➔ ');
    return (
      <div
        key={bigSet.id}
        className={`rounded-2xl border-2 transition-all ${
          bigSet.completed ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
        }`}
      >
        {/* 折叠态：一行摘要，可点展开 */}
        <div
          onClick={() => toggleDropSetExpanded(bigSet.id)}
          className="p-3 flex items-center justify-between gap-2 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 ${
              bigSet.completed ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'
            }`}>
              第 {bigSet.setNumber} 大组
            </span>
            <span className="text-[11px] text-slate-500 truncate font-mono">{summary || '暂无阶梯'}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSetComplete(exIdx, setIdx); }}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${
                bigSet.completed
                  ? 'bg-emerald-600 text-white shadow-md animate-check-pop'
                  : 'bg-white text-slate-300 border-2 border-slate-200'
              }`}
            >
              <Check className="w-5 h-5 stroke-[3]" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {/* 展开态：阶梯调整 */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 space-y-1.5 animate-card-in">
            <div className="pt-2 space-y-1.5">
              {stages.map((stage, stageIdx) => (
                <div
                  key={stage.id}
                  className="bg-white p-2 rounded-xl border border-slate-200/90 flex items-center justify-between text-xs gap-1 flex-wrap"
                >
                  <span className="text-slate-400 font-mono text-[11px] font-bold shrink-0">#{stageIdx + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'weightOrPlates', -2.5)}
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black active:scale-95 text-slate-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      value={stage.weightOrPlates || ''}
                      onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
                      className="w-14 text-center bg-slate-50 border border-slate-200 rounded-lg py-1.5 font-black text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'weightOrPlates', 2.5)}
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black active:scale-95 text-slate-700"
                    >
                      ＋
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'reps', -1)}
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black active:scale-95 text-slate-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={stage.reps || ''}
                      onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'reps', parseInt(e.target.value) || 0)}
                      className="w-12 text-center bg-slate-50 border border-slate-200 rounded-lg py-1.5 font-black text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400 font-semibold">次</span>
                    <button
                      type="button"
                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'reps', 1)}
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl font-black active:scale-95 text-slate-700"
                    >
                      ＋
                    </button>
                  </div>
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDropStageFromSet(exIdx, setIdx, stageIdx)}
                      className="text-slate-300 hover:text-red-500 p-1.5 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addDropStageToSet(exIdx, setIdx)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" /> 加一个递减重量
            </button>
          </div>
        )}
      </div>
    );
  };

  // 聚焦动作卡片
  const renderFocusCard = () => {
    if (!activeSession || !focusEx || !focusCat) {
      return (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">还没有动作，从动作库添加第一个动作开始</p>
          <button
            onClick={() => setShowAddExModal(true)}
            className="mt-3 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-4 h-4 inline mr-1" /> 添加动作
          </button>
        </div>
      );
    }
    const exIdx = safeFocusIdx;
    const isDrop = focusEx.sets.some(s => s.isDropSet);
    // 单侧仅做普通组，isDropSet 为真一律按超级组渲染
    const isUnilateralEx = Boolean(focusEx.isUnilateral) && !isDrop;
    const summary = lastLogSummary(focusLastLog);
    return (
      <div key={focusEx.exerciseId + '-' + exIdx} className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm animate-card-in">
        {/* 头部：动作名 + 类别 + 规格胶囊 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{focusEx.exerciseName}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${focusCat.bg} ${focusCat.color}`}>
                {focusCat.label}
              </span>
              {isDrop && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">🔥超级组</span>
              )}
              {isUnilateralEx && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">左右独立</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSpecExIdx(exIdx)}
              className="mt-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center gap-1"
            >
              {UNIT_SHORT[focusEx.currentUnit]} · {PULLEY_SHORT[focusEx.pulleyRatio]} <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={() => removeExercise(exIdx)}
            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 shrink-0"
            title="移除动作"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* 上次参考一行 */}
        {summary && focusLastLog && (
          <div className="mt-2.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-700 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">上次：{summary}</span>
            </div>
            <button
              onClick={() => applyLastLog(exIdx, focusLastLog)}
              className="text-[11px] underline font-bold shrink-0"
            >
              一键带入
            </button>
          </div>
        )}

        {/* 组列表 */}
        <div className="mt-2.5 space-y-2">
          {isDrop
            ? focusEx.sets.map((bigSet, setIdx) => renderDropBigSet(exIdx, bigSet, setIdx))
            : isUnilateralEx
            ? (
              <>
                <div className="grid grid-cols-12 gap-1.5 text-[11px] font-bold text-slate-400 px-1">
                  <div className="col-span-2 text-center">组</div>
                  <div className="col-span-4 text-center">左</div>
                  <div className="col-span-4 text-center">右</div>
                  <div className="col-span-2 text-center">✓</div>
                </div>
                {focusEx.sets.map((set, setIdx) => renderUnilateralSetRow(exIdx, set, setIdx))}
              </>
            )
            : (
              <>
                <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 px-1">
                  <div className="col-span-2 text-center">组</div>
                  <div className="col-span-6 text-center">{UNIT_LABELS[focusEx.currentUnit] || '负荷'}</div>
                  <div className="col-span-2 text-center">次</div>
                  <div className="col-span-2 text-center">✓</div>
                </div>
                {focusEx.sets.map((set, setIdx) => renderSetRow(exIdx, set, setIdx))}
              </>
            )}
        </div>

        {/* 加组 / 删组 */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => addSetToExercise(exIdx)}
            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-200 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> {isDrop ? '加一大组' : '加一组'}
          </button>
          {focusEx.sets.length > 1 && (
            <button
              onClick={() => removeSet(exIdx, focusEx.sets.length - 1)}
              className="text-xs text-slate-400 hover:text-red-600 px-2 py-2"
            >
              {isDrop ? '删除末尾大组' : '删除末尾组'}
            </button>
          )}
        </div>

        {/* 动作切换 */}
        <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFocusIdx(i => Math.max(0, i - 1))}
            disabled={exIdx === 0}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-blue-600 disabled:text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" /> 上一个
          </button>
          <span className="text-[11px] text-slate-400 font-bold">‹ {exIdx + 1}/{activeSession.exercises.length} ›</span>
          <button
            type="button"
            onClick={() => setFocusIdx(i => Math.min(activeSession.exercises.length - 1, i + 1))}
            disabled={exIdx === activeSession.exercises.length - 1}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-blue-600 disabled:text-slate-300"
          >
            下一个 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 pt-2">
      {!activeSession ? (
        <>
          {/* 头部 */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">FitCustom Pro</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">今日训练</h1>
            {renderCompass()}
          </div>

          {/* 今日休息日状态横幅 */}
          {todayRestSession && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold">
                  <Coffee className="w-4 h-4" />
                </div>
                <span className="font-black text-amber-950 text-sm">今日已安排完全休息</span>
              </div>
              <button
                type="button"
                onClick={() => handleCancelRestDay(todayRestSession.id)}
                className="text-xs text-amber-800 hover:text-red-600 font-bold underline"
              >
                取消重新开练
              </button>
            </div>
          )}

          {/* 今日状态卡：开练 / 休息 / 补签三段切换 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold mb-3">
              {([
                { key: 'train', label: '🏋️ 开练' },
                { key: 'rest', label: '☕ 今日休息' },
                { key: 'backfill', label: '📝 补签' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatusCardTab(t.key)}
                  className={`py-2 rounded-lg transition-all ${
                    statusCardTab === t.key
                      ? 'bg-white shadow-sm text-blue-700 font-black'
                      : 'text-slate-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {statusCardTab === 'train' && (
              <div className="animate-card-in">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">选择分化计划开练</h3>
                  </div>
                  <button
                    onClick={onOpenPlansTab}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    管理全部计划 →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {plans.map((p) => {
                    const isLeg = p.name.includes('腿');
                    return (
                      <div
                        key={p.id}
                        onClick={() => startPlan(p)}
                        className="group bg-slate-50 hover:bg-blue-50/40 border border-slate-200/90 hover:border-blue-400/60 rounded-xl p-3.5 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                                {p.name}
                              </h4>
                              {isLeg ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">下肢专注</span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 font-medium">+20m有氧</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{p.description}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span>包含 {p.exercises.length} 个动作</span>
                          <span className="text-blue-600 font-semibold">点击一键载入 →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={startFreeWorkout}
                  className="w-full mt-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" /> 自由训练（不选预设计划）
                </button>
              </div>
            )}

            {statusCardTab === 'rest' && (
              <div className="animate-card-in text-center py-4">
                {todayRestSession ? (
                  <p className="text-sm text-amber-800 font-bold">今日已安排完全休息，好好恢复 💤</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-3">今天不练？一键打卡完全休息，串联训练周期</p>
                    <button
                      type="button"
                      onClick={handleLogRestDay}
                      className="px-6 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-2xl text-sm font-black inline-flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Coffee className="w-4 h-4 text-amber-700" /> 今日完全休息
                    </button>
                  </>
                )}
              </div>
            )}

            {statusCardTab === 'backfill' && (
              <div className="animate-card-in">
                <p className="text-xs text-slate-500 mb-2.5">之前漏打卡了？选择过去某天补上休息记录</p>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="date"
                    value={backfillDate}
                    max={yesterdayLocalDate()}
                    onChange={(e) => { setBackfillDate(e.target.value); setBackfillMsg(null); }}
                    className="bg-slate-100 text-slate-700 text-xs px-2.5 py-2 rounded-lg border border-slate-200 font-medium flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleBackfillRestDay}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-700" /> 补签休息
                  </button>
                </div>
                {backfillMsg && (
                  <p className="mt-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                    {backfillMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 专注模式顶部：细进度条 + 罗盘 */}
          <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-1 pt-1 pb-2 border-b border-slate-200/90 mb-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="truncate">{activeSession.planName} · 专注模式</span>
              <span className="text-blue-700 font-mono shrink-0 ml-2">{totalCompletedSets} / {totalAllSets} 组</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full progress-fill" style={{ width: `${progressPct}%` }}></div>
            </div>
            {renderCompass()}
          </div>

          <div className="space-y-3 pb-24">
            {renderFocusCard()}

            {/* 添加动作入口 */}
            <button
              onClick={() => setShowAddExModal(true)}
              className="w-full py-3 bg-white hover:bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-500/70 rounded-2xl text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4 text-blue-600" /> 从动作库添加动作
            </button>

            {/* 有氧折叠行（腿日自动隐藏） */}
            {!activeSession.planName.includes('腿') && (
              <div className="bg-white border border-pink-200 rounded-2xl shadow-sm overflow-hidden">
                <div
                  onClick={() => setShowCardio(v => !v)}
                  className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-pink-600" />
                    <span className="font-bold text-sm">
                      有氧 <span className="text-xs font-normal text-slate-400">
                        {activeSession.cardioCompleted ? `${activeSession.cardioMinutes}分钟 · ${activeSession.cardioType || ''}` : '（点开展开）'}
                      </span>
                    </span>
                  </div>
                  {showCardio ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {showCardio && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 animate-card-in">
                    <label className="relative inline-flex items-center cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={activeSession.cardioCompleted}
                        onChange={(e) => {
                          updateActiveSession({
                            ...activeSession,
                            cardioCompleted: e.target.checked,
                            cardioMinutes: e.target.checked ? (activeSession.cardioMinutes || 20) : 0
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                      <span className="ml-2 text-xs text-slate-600">完成有氧</span>
                    </label>
                    {activeSession.cardioCompleted && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">时长:</span>
                          {[15, 20, 25, 30].map(mins => (
                            <button
                              key={mins}
                              onClick={() => updateActiveSession({ ...activeSession, cardioMinutes: mins })}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeSession.cardioMinutes === mins
                                  ? 'bg-pink-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {mins}分
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={activeSession.cardioNotes || ''}
                          onChange={(e) => updateActiveSession({ ...activeSession, cardioNotes: e.target.value })}
                          placeholder="例如: 跑步机坡度 10，速度 5.0 km/h 快走"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 备注折叠行 */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div
                onClick={() => setShowNotes(v => !v)}
                className="p-3.5 flex items-center justify-between cursor-pointer select-none"
              >
                <span className="font-bold text-sm text-slate-400">
                  📝 训练备注 <span className="text-xs font-normal">{activeSession.notes ? '' : '（点开展开）'}</span>
                </span>
                {showNotes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {showNotes && (
                <div className="px-4 pb-4 animate-card-in">
                  <textarea
                    rows={2}
                    value={activeSession.notes || ''}
                    onChange={(e) => updateActiveSession({ ...activeSession, notes: e.target.value })}
                    placeholder="记录今日力量状态、器械手感、酸痛度等..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}
            </div>

            {/* 放弃训练（文字链，不再是半幅大按钮） */}
            <div className="text-center pt-1">
              <button
                onClick={handleAbandonSession}
                className="text-xs text-slate-400 hover:text-red-600 underline"
              >
                放弃本次训练
              </button>
            </div>
          </div>

          {/* 悬浮结束钮 */}
          <button
            onClick={() => setShowFinishModal(true)}
            className="fixed bottom-8 right-5 z-40 w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 font-black text-xs leading-tight active:scale-95 transition-all"
          >
            结束<br />{totalCompletedSets}/{totalAllSets}
          </button>
        </>
      )}

      {/* 规格抽屉：单位 + 滑轮 */}
      {specExIdx !== null && activeSession && activeSession.exercises[specExIdx] && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end justify-center animate-fade-in"
          onClick={() => setSpecExIdx(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8 shadow-2xl animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-sm mb-1">{activeSession.exercises[specExIdx].exerciseName}</h3>
            <p className="text-[11px] text-slate-400 mb-3">计量规格（修改后整组同步）</p>
            <div className="text-xs font-bold text-slate-600 mb-1.5">计量单位</div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {(['plates', 'kg', 'assisted', 'bodyweight'] as ResistanceUnit[]).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => changeExerciseUnit(specExIdx, u)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeSession.exercises[specExIdx].currentUnit === u
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
                  onClick={() => changePulleyRatio(specExIdx, p)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeSession.exercises[specExIdx].pulleyRatio === p
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p === 'none' ? '普通器械' : p === '1:1' ? '单滑轮 1:1' : '双滑轮 2:1'}
                </button>
              ))}
            </div>

            {/* 记录方式：双侧 / 左右手分开（超级组阶梯不支持分侧，故置灰） */}
            {(() => {
              const specEx = activeSession.exercises[specExIdx];
              const isDrop = specEx.sets.some(s => s.isDropSet);
              const isUni = Boolean(specEx.isUnilateral) && !isDrop;
              return (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-600 shrink-0">记录方式</span>
                    <div className="grid grid-cols-2 gap-1 flex-1 min-w-0">
                      <button
                        type="button"
                        disabled={isDrop}
                        onClick={() => changeRecordMode(specExIdx, false, false)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
                          !isUni ? 'bg-slate-700 text-white shadow' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        双侧
                      </button>
                      <button
                        type="button"
                        disabled={isDrop}
                        onClick={() => changeRecordMode(specExIdx, true, false)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
                          isUni ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        左右手分开
                      </button>
                    </div>
                  </div>
                  {isDrop ? (
                    <p className="text-[10px] text-slate-400 mb-4">递减超级组按大组记录，不支持左右分开</p>
                  ) : (
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(specEx.isUnilateral)}
                        onChange={(e) => changeRecordMode(specExIdx, Boolean(specEx.isUnilateral), e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span>同时记住到动作库（以后该动作默认左右分开）</span>
                    </label>
                  )}
                </>
              );
            })()}
            <button
              type="button"
              onClick={() => setSpecExIdx(null)}
              className="w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* 添加动作模态框 */}
      {showAddExModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col p-4 shadow-2xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">从动作库选择加入</h3>
              <button
                onClick={() => setShowAddExModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-lg bg-slate-100"
              >
                关闭
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                placeholder="搜索动作名称（如 卧推、深蹲、夹胸）..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* 自定义新动作：默认收起，点开才展开表单 */}
            <button
              type="button"
              onClick={() => { setShowCustomForm(v => !v); setCustomError(null); }}
              aria-expanded={showCustomForm}
              className="w-full mb-2 px-3 py-2 border border-dashed border-indigo-300 bg-indigo-50/60 rounded-xl flex items-center gap-2 text-left active:scale-[0.99] transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-black text-indigo-800 shrink-0">自定义新动作</span>
              <span className="text-[10px] text-slate-400 truncate flex-1 min-w-0">动作库里没有？在这里直接新增</span>
              {showCustomForm ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>

            {showCustomForm && (
              <div className="mb-2 p-3 border border-slate-200 rounded-xl bg-slate-50/70 space-y-2.5 animate-card-in">
                {customError && (
                  <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{customError}</p>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">动作名称 *</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="例如: 史密斯下斜推胸"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">目标肌肉群</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as MuscleCategory)}
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
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as ResistanceUnit)}
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
                    value={customPulley}
                    onChange={(e) => setCustomPulley(e.target.value as PulleyRatio)}
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
                    <span className="block text-[10px] text-slate-400">开启后训练时左右分别记录</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={customUnilateral}
                    onChange={(e) => setCustomUnilateral(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 shrink-0"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCustomName(''); setCustomNotes(''); setCustomUnilateral(false); setCustomError(null); }}
                    className="py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                  >
                    清空
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customName.trim()) { setCustomError('请输入动作名称'); return; }
                      createAndAddCustomExercise({
                        name: customName, category: customCategory, defaultUnit: customUnit,
                        defaultPulley: customPulley, isUnilateral: customUnilateral, notes: customNotes,
                      });
                      setCustomName(''); setCustomNotes(''); setCustomUnilateral(false);
                      setCustomError(null); setShowCustomForm(false);
                    }}
                    className="py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95"
                  >
                    保存并加入本次训练
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allExercises
                .filter(e => !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(e => {
                  const cat = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.chest;
                  return (
                    <div
                      key={e.id}
                      onClick={() => addExerciseToCurrent(e)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600">{e.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cat.bg} ${cat.color}`}>{cat.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">默认: {UNIT_LABELS[e.defaultUnit]}</p>
                      </div>
                      <Plus className="w-4 h-4 text-blue-600 group-hover:scale-125 transition-transform" />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 完成训练祝贺弹窗 */}
      {showFinishModal && activeSession && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900">今日训练圆满完成！</h3>
            <p className="text-xs text-slate-500 mt-1">坚持渐进超负荷，肌肉正在茁壮成长</p>

            <div className="grid grid-cols-3 gap-2 my-5 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              <div>
                <span className="text-[10px] text-slate-400 block">动作数量</span>
                <span className="font-mono text-sm font-bold text-slate-900">{activeSession.exercises.length} 个</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">完成总组数</span>
                <span className="font-mono text-sm font-bold text-emerald-600">{totalCompletedSets} 组</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">有氧燃脂</span>
                <span className="font-mono text-sm font-bold text-pink-600">
                  {activeSession.cardioCompleted ? `${activeSession.cardioMinutes}m` : '0m'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                继续调整
              </button>
              <button
                onClick={finishSession}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                确认归档记录
              </button>
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
