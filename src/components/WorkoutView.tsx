import { useState, useEffect } from 'react';
import { 
  Play, Plus, Check, Trash2, 
  Dumbbell, Flame, 
  CheckCircle2, Sparkles, Award
} from 'lucide-react';
import { 
  WorkoutPlan, WorkoutSession, ExerciseLog, WorkoutSet, 
  ResistanceUnit, PulleyRatio, CATEGORY_LABELS, UNIT_LABELS, Exercise 
} from '../types';
import { StorageService } from '../utils/storage';

interface WorkoutViewProps {
  onOpenPlansTab: () => void;
  onOpenLibraryTab: () => void;
  allExercises: Exercise[];
}

export const WorkoutView: React.FC<WorkoutViewProps> = ({
  onOpenPlansTab,
  allExercises
}) => {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);

  useEffect(() => {
    setPlans(StorageService.getPlans());
    const savedActive = StorageService.getActiveSession();
    if (savedActive) {
      setActiveSession(savedActive);
    }
  }, []);

  // 同步活动状态到本地缓存
  const updateActiveSession = (updated: WorkoutSession | null) => {
    setActiveSession(updated);
    StorageService.saveActiveSession(updated);
  };

  // 启动某个计划
  const startPlan = (plan: WorkoutPlan) => {
    const exerciseLogs: ExerciseLog[] = plan.exercises.map(pe => {
      const exDetail = allExercises.find(e => e.id === pe.exerciseId);
      const lastLog = StorageService.getLastExerciseLog(pe.exerciseId);

      const unit: ResistanceUnit = pe.targetUnit || exDetail?.defaultUnit || 'kg';
      const pulley: PulleyRatio = pe.pulleyRatio || exDetail?.defaultPulley || 'none';
      const isDropSet = Boolean(pe.isDropSet || (pe.dropStages && pe.dropStages.length > 0));

      const baseDropStages = pe.dropStages && pe.dropStages.length > 0
        ? pe.dropStages
        : [
            { id: 'stg-1', weightOrPlates: 10, unit: 'kg' as ResistanceUnit, reps: 12 },
            { id: 'stg-2', weightOrPlates: 7.5, unit: 'kg' as ResistanceUnit, reps: 12 },
            { id: 'stg-3', weightOrPlates: 5, unit: 'kg' as ResistanceUnit, reps: 10 },
            { id: 'stg-4', weightOrPlates: 2.5, unit: 'kg' as ResistanceUnit, reps: 12 },
          ];

      // 默认生成组数（支持超级组大组 + 各阶梯重量次数独立注入）
      const sets: WorkoutSet[] = Array.from({ length: pe.targetSets || 4 }, (_, i) => {
        const lastSet = lastLog?.sets[i];

        if (isDropSet) {
          const currentStages = lastSet?.dropStages && lastSet.dropStages.length > 0
            ? JSON.parse(JSON.stringify(lastSet.dropStages))
            : JSON.parse(JSON.stringify(baseDropStages));

          return {
            id: `s-${Date.now()}-${i}`,
            setNumber: i + 1,
            unit: 'kg' as ResistanceUnit,
            weightOrPlates: currentStages[0]?.weightOrPlates || 10,
            reps: currentStages[0]?.reps || 12,
            completed: false,
            pulleyRatio: pulley,
            isDropSet: true,
            dropStages: currentStages,
          };
        }

        const defaultWeight = pe.targetWeight !== undefined 
          ? pe.targetWeight 
          : (lastSet?.weightOrPlates ?? (unit === 'plates' ? 10 : 30));
        const defaultReps = pe.targetReps !== undefined
          ? pe.targetReps
          : (lastSet?.reps ?? 12);

        return {
          id: `s-${Date.now()}-${i}`,
          setNumber: i + 1,
          unit: pe.targetUnit || lastSet?.unit || unit,
          weightOrPlates: defaultWeight,
          reps: defaultReps,
          completed: false,
          pulleyRatio: pe.pulleyRatio || lastSet?.pulleyRatio || pulley,
        };
      });

      return {
        exerciseId: pe.exerciseId,
        exerciseName: exDetail?.name || '未知动作',
        category: exDetail?.category || 'chest',
        pulleyRatio: pulley,
        currentUnit: unit,
        sets,
        notes: pe.notes || ''
      };
    });

    const newSession: WorkoutSession = {
      id: `sess-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      planId: plan.id,
      planName: plan.name,
      startTime: Date.now(),
      exercises: exerciseLogs,
      cardioMinutes: plan.cardioMinutes,
      cardioCompleted: plan.cardioMinutes > 0,
      cardioType: plan.cardioType || (plan.cardioMinutes > 0 ? '跑步机坡度快走' : undefined),
      cardioNotes: plan.cardioMinutes > 0 ? '坡度 10，速度 5.0 km/h 维持心率' : '',
    };

    updateActiveSession(newSession);
  };

  // 启动自由训练
  const startFreeWorkout = () => {
    const newSession: WorkoutSession = {
      id: `sess-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      planName: '自由训练',
      startTime: Date.now(),
      exercises: [],
      cardioMinutes: 20,
      cardioCompleted: false,
      cardioType: '跑步机坡度快走',
    };
    updateActiveSession(newSession);
  };

  // 添加新动作到当前训练
  const addExerciseToCurrent = (exercise: Exercise) => {
    if (!activeSession) return;
    const lastLog = StorageService.getLastExerciseLog(exercise.id);
    const unit = lastLog?.currentUnit || exercise.defaultUnit || 'plates';
    const pulley = lastLog?.pulleyRatio || exercise.defaultPulley || 'none';

    const defaultSets: WorkoutSet[] = [1, 2, 3, 4].map((num, i) => {
      const lastSet = lastLog?.sets[i];
      return {
        id: `s-${Date.now()}-${num}`,
        setNumber: num,
        unit: lastSet?.unit || unit,
        weightOrPlates: lastSet?.weightOrPlates || (unit === 'plates' ? 8 : 40),
        reps: lastSet?.reps || 12,
        completed: false,
        pulleyRatio: lastSet?.pulleyRatio || pulley
      };
    });

    const newExLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      pulleyRatio: pulley,
      currentUnit: unit,
      sets: defaultSets,
      notes: exercise.notes || ''
    };

    const updated: WorkoutSession = {
      ...activeSession,
      exercises: [...activeSession.exercises, newExLog]
    };
    updateActiveSession(updated);
    setShowAddExModal(false);
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

  // 删除动作
  const removeExercise = (exIndex: number) => {
    if (!activeSession) return;
    const exercises = [...activeSession.exercises];
    exercises.splice(exIndex, 1);
    updateActiveSession({ ...activeSession, exercises });
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
    setShowFinishModal(false);
  };

  // 计算已完成总组数与总计划组数
  const totalCompletedSets = activeSession?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0
  ) || 0;
  const totalAllSets = activeSession?.exercises.reduce(
    (acc, ex) => acc + ex.sets.length, 0
  ) || 0;

  return (
    <div className="pb-24 pt-2">
      {/* 头部状态条 */}
      {!activeSession ? (
        <div className="mb-6">
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
          <p className="text-xs text-slate-500 mt-0.5">记录每组重量与片数，自动累积力量进展</p>
        </div>
      ) : (
        /* 进行中训练常驻顶部看板（无倒计时，清爽记录） */
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md pb-3 pt-1 border-b border-slate-200/90 mb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{activeSession.planName}</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-blue-700">
                  {totalCompletedSets} / {totalAllSets} 组
                </span>
              </div>

              <button
                onClick={() => setShowFinishModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" /> 完成训练
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2.5 text-xs text-slate-500">
            <span>动作数: <strong className="text-slate-800">{activeSession.exercises.length}</strong></span>
            <span>已完成: <strong className="text-emerald-600 font-bold">{totalCompletedSets}</strong> 组</span>
            {activeSession.cardioMinutes > 0 && (
              <span className="text-pink-600 font-medium flex items-center gap-1">
                <Flame className="w-3 h-3" /> 有氧目标 {activeSession.cardioMinutes} 分钟
              </span>
            )}
          </div>
        </div>
      )}

      {/* 尚未开始训练时的选择卡片 */}
      {!activeSession && (
        <div className="space-y-4">
          {/* 快捷推荐计划循环 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
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
                    className="group bg-slate-50 hover:bg-blue-50/40 border border-slate-200/90 hover:border-blue-400/60 rounded-xl p-3.5 transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden"
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
        </div>
      )}

      {/* 处于活动训练中：动作卡片列表 */}
      {activeSession && (
        <div className="space-y-4">
          {activeSession.exercises.map((exLog, exIdx) => {
            const catInfo = CATEGORY_LABELS[exLog.category] || CATEGORY_LABELS.chest;
            const lastLog = StorageService.getLastExerciseLog(exLog.exerciseId);

            return (
              <div
                key={`${exLog.exerciseId}-${exIdx}`}
                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm relative overflow-hidden"
              >
                {/* 动作头部信息 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{exLog.exerciseName}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catInfo.bg} ${catInfo.color}`}>
                        {catInfo.label}
                      </span>
                    </div>

                    {/* 单位与滑轮切换控制栏 */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {/* 单位切换 */}
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]">
                        {(['plates', 'kg', 'assisted', 'bodyweight'] as ResistanceUnit[]).map((u) => (
                          <button
                            key={u}
                            onClick={() => changeExerciseUnit(exIdx, u)}
                            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                              exLog.currentUnit === u
                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {u === 'plates' ? '插销(片)' : u === 'kg' ? '重量(kg)' : u === 'assisted' ? '助力' : '自重'}
                          </button>
                        ))}
                      </div>

                      {/* 滑轮比例 */}
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px]">
                        {(['none', '1:1', '2:1'] as PulleyRatio[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => changePulleyRatio(exIdx, p)}
                            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                              exLog.pulleyRatio === p
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {p === 'none' ? '普通器械' : p === '1:1' ? '单滑轮 1:1' : '双滑轮 2:1'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeExercise(exIdx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-slate-100"
                    title="移除动作"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* 上次历史表现浮标（若存在） */}
                {lastLog && (
                  <div className="mb-3 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-700">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        上次参考: {lastLog.sets.filter((s: WorkoutSet) => s.completed).map((s: WorkoutSet) => `${s.weightOrPlates}${s.unit === 'plates' ? '片' : 'kg'}×${s.reps}`).join(' / ') || '无记录'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        // 一键克隆上次数据到当前各组
                        const exercises = [...activeSession.exercises];
                        exercises[exIdx].sets.forEach((s, idx) => {
                          const lastSet = lastLog.sets[idx];
                          if (lastSet) {
                            s.weightOrPlates = lastSet.weightOrPlates;
                            s.reps = lastSet.reps;
                            s.unit = lastSet.unit;
                          }
                        });
                        updateActiveSession({ ...activeSession, exercises });
                      }}
                      className="text-[11px] underline font-bold text-blue-700 hover:text-blue-900"
                    >
                      一键带入
                    </button>
                  </div>
                )}

                {/* 组数列表：超级组大组递减阶梯模式 vs 普通动作模式 */}
                {exLog.sets.some(s => s.isDropSet) ? (
                  <div className="space-y-3">
                    {exLog.sets.map((bigSet, setIdx) => {
                      const stages = bigSet.dropStages || [];
                      return (
                        <div
                          key={bigSet.id}
                          className={`rounded-2xl p-3 border transition-all ${
                            bigSet.completed
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          {/* 大组头部 */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                                第 {bigSet.setNumber} 大组
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {stages.length}个连续递减重量
                              </span>
                            </div>

                            {/* 大组完成打勾 */}
                            <button
                              type="button"
                              onClick={() => toggleSetComplete(exIdx, setIdx)}
                              className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 transition-all active:scale-95 ${
                                bigSet.completed
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                                  : 'bg-white text-slate-400 hover:text-slate-700 border border-slate-200/90 shadow-2xs'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              {bigSet.completed ? '已完成大组' : '完成该大组'}
                            </button>
                          </div>

                          {/* 阶梯小组列表 (各重量与次数独立调整) */}
                          <div className="mt-2.5 space-y-1.5">
                            {stages.map((stage, stageIdx) => {
                              return (
                                <div
                                  key={stage.id}
                                  className="bg-white p-2 rounded-xl border border-slate-200/90 flex items-center justify-between text-xs gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center gap-1 shrink-0 text-slate-400 font-mono text-[11px] font-bold">
                                    <span>#{stageIdx + 1}</span>
                                    {stageIdx > 0 && <span className="text-slate-300">➔</span>}
                                  </div>

                                  {/* 阶梯重量步进 */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'weightOrPlates', -2.5)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded text-xs font-black active:scale-95 text-slate-700"
                                    >
                                      -
                                    </button>
                                    <div className="flex items-center gap-0.5">
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={stage.weightOrPlates}
                                        onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
                                        className="w-12 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs font-black text-slate-900"
                                      />
                                      <span className="text-[10px] text-slate-400 font-semibold">{stage.unit || 'kg'}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'weightOrPlates', 2.5)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded text-xs font-black active:scale-95 text-slate-700"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* 阶梯次数步进 */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'reps', -1)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded text-xs font-black active:scale-95 text-slate-700"
                                    >
                                      -
                                    </button>
                                    <div className="flex items-center gap-0.5">
                                      <input
                                        type="number"
                                        value={stage.reps}
                                        onChange={(e) => setDropStageDirectVal(exIdx, setIdx, stageIdx, 'reps', parseInt(e.target.value) || 0)}
                                        className="w-10 text-center bg-slate-50 border border-slate-200 rounded py-0.5 text-xs font-black text-slate-900"
                                      />
                                      <span className="text-[10px] text-slate-400 font-semibold">次</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateDropStageField(exIdx, setIdx, stageIdx, 'reps', 1)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded text-xs font-black active:scale-95 text-slate-700"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* 删除该阶梯 (如果超过1个) */}
                                  {stages.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeDropStageFromSet(exIdx, setIdx, stageIdx)}
                                      className="text-slate-300 hover:text-red-500 p-1"
                                      title="删除该递减段"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* 阶梯操作栏 */}
                          <div className="mt-2 pt-1.5 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => addDropStageToSet(exIdx, setIdx)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
                            >
                              <Plus className="w-3 h-3" /> 加一个递减重量
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 普通动作：单行组数列表 */
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 px-1">
                      <div className="col-span-2 text-center">组数</div>
                      <div className="col-span-5 text-center">
                        {UNIT_LABELS[exLog.currentUnit] || '负荷'}
                      </div>
                      <div className="col-span-3 text-center">次数</div>
                      <div className="col-span-2 text-center">打钩</div>
                    </div>

                    {exLog.sets.map((set, setIdx) => {
                      const isPlates = set.unit === 'plates';
                      return (
                        <div
                          key={set.id}
                          className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all ${
                            set.completed
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : 'bg-slate-50 border-slate-200/90'
                          }`}
                        >
                          {/* 组号 */}
                          <div className="col-span-2 flex items-center justify-center">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                              set.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {set.setNumber}
                            </span>
                          </div>

                          {/* 重量/片数调整器 */}
                          <div className="col-span-5 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? -1 : -2.5)}
                              className="w-7 h-7 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200/90 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs transition-transform"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={set.weightOrPlates}
                              onChange={(e) => setDirectVal(exIdx, setIdx, 'weightOrPlates', parseFloat(e.target.value) || 0)}
                              className="w-14 text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-black text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => updateSetField(exIdx, setIdx, 'weightOrPlates', isPlates ? 1 : 2.5)}
                              className="w-7 h-7 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200/90 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs transition-transform"
                            >
                              +
                            </button>
                          </div>

                          {/* 次数调整器 */}
                          <div className="col-span-3 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateSetField(exIdx, setIdx, 'reps', -1)}
                              className="w-6 h-7 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200/90 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs transition-transform"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={set.reps}
                              onChange={(e) => setDirectVal(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                              className="w-10 text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-black text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => updateSetField(exIdx, setIdx, 'reps', 1)}
                              className="w-6 h-7 bg-white hover:bg-slate-100 active:scale-95 border border-slate-200/90 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs transition-transform"
                            >
                              +
                            </button>
                          </div>

                          {/* 完成勾选按钮 */}
                          <div className="col-span-2 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => toggleSetComplete(exIdx, setIdx)}
                              className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                                set.completed
                                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20 scale-105'
                                  : 'bg-white hover:bg-slate-50 text-slate-300 hover:text-slate-600 border border-slate-200/90 shadow-2xs'
                              }`}
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 增加一组 / 加一大组按钮 */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => addSetToExercise(exIdx)}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-200 shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> {exLog.sets.some(s => s.isDropSet) ? '加一大组' : '加一组'}
                  </button>

                  {exLog.sets.length > 1 && (
                    <button
                      onClick={() => removeSet(exIdx, exLog.sets.length - 1)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      {exLog.sets.some(s => s.isDropSet) ? '删除末尾大组' : '删除末尾组'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 添加动作入口按钮 */}
          <button
            onClick={() => setShowAddExModal(true)}
            className="w-full py-3.5 bg-white hover:bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-500/70 rounded-2xl text-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4 text-blue-600" /> 从动作库添加动作
          </button>

          {/* 附加有氧模块 (针对非腿日或自定义安排) */}
          <div className="bg-white border border-pink-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-pink-600" />
                <h4 className="font-bold text-slate-900 text-sm">练后附加有氧 (20分钟)</h4>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
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
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
              </label>
            </div>

            {activeSession.cardioCompleted && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">有氧时长:</span>
                  {[15, 20, 25, 30].map(mins => (
                    <button
                      key={mins}
                      onClick={() => updateActiveSession({ ...activeSession, cardioMinutes: mins })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeSession.cardioMinutes === mins
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mins} 分钟
                    </button>
                  ))}
                </div>

                <div>
                  <span className="text-xs text-slate-500">项目与感受:</span>
                  <input
                    type="text"
                    value={activeSession.cardioNotes || ''}
                    onChange={(e) => updateActiveSession({ ...activeSession, cardioNotes: e.target.value })}
                    placeholder="例如: 跑步机坡度 10，速度 5.0 km/h 快走，出汗良好"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 今日训练总评与感受 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-2">训练备注</h4>
            <textarea
              rows={2}
              value={activeSession.notes || ''}
              onChange={(e) => updateActiveSession({ ...activeSession, notes: e.target.value })}
              placeholder="记录今日力量状态、器械手感、酸痛度等..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* 底部操作条：放弃本次训练与结束保存一人一半 */}
          <div className="grid grid-cols-2 gap-3 pt-3 pb-3">
            <button
              onClick={() => {
                if (window.confirm('确定放弃并清空当前正在记录的训练吗？')) {
                  updateActiveSession(null);
                }
              }}
              className="w-full py-3.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-2xl text-xs font-bold border border-slate-200 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" /> 放弃本次训练
            </button>
            <button
              onClick={() => setShowFinishModal(true)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" /> 结束并保存记录
            </button>
          </div>
        </div>
      )}

      {/* 添加动作模态框 */}
      {showAddExModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4">
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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
                className="flex-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                确认归档记录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
