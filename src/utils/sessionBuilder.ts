import {
  WorkoutPlan, WorkoutSession, ExerciseLog, WorkoutSet,
  ResistanceUnit, Exercise, DropStage,
} from '../types';
import { StorageService } from './storage';
import { todayLocalDate } from './date';
import {
  newSessionCardioDefaults,
  newSessionPulleyRatio,
  seedWeightsOnly,
  WorkoutSetMode,
} from './trainingRules';

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

const getWeightSeed = (
  lastLog: ExerciseLog | null,
  setIndex: number,
  unit: ResistanceUnit,
  mode: WorkoutSetMode,
) => {
  const matchingSets = (lastLog?.sets || []).filter(set =>
    set.completed && seedWeightsOnly(set, unit, mode) !== null,
  );
  return seedWeightsOnly(matchingSets[setIndex] || matchingSets[matchingSets.length - 1], unit, mode);
};

// 由训练计划一键构建进行中的会话。
// 统一供 WorkoutView 与 App（计划页一键开练）使用，
// 保证超级组阶梯预设与上次训练参考数据在两条入口注入一致。
export function buildSessionFromPlan(
  plan: WorkoutPlan,
  allExercises: Exercise[],
): WorkoutSession {
  const sessionId = `sess-${Date.now()}`;
  const exerciseLogs: ExerciseLog[] = plan.exercises.map((pe, exIdx) => {
    const exDetail = allExercises.find(e => e.id === pe.exerciseId);
    const lastLog = StorageService.getLastExerciseLog(pe.exerciseId);

    const unit: ResistanceUnit = pe.targetUnit || exDetail?.defaultUnit || 'kg';
    const isDropSet = pe.isDropSet !== undefined
      ? pe.isDropSet
      : Boolean(pe.dropStages?.length || exDetail?.isDropSet);
    // 单侧（左右独立）仅用于普通组：超级组阶梯暂不支持分侧
    const isUnilateral = !isDropSet && (
      pe.isUnilateral !== undefined ? pe.isUnilateral : Boolean(exDetail?.isUnilateral)
    );

    // 模板决定阶梯结构；结构与单位相同的重复动作沿用上次重量，次数由本次填写。
    const explicitStages = pe.dropStages?.length
      ? pe.dropStages
      : (exDetail?.isDropSet && exDetail.dropStages?.length ? exDetail.dropStages : null);

    const sets: WorkoutSet[] = Array.from({ length: pe.targetSets || 4 }, (_, i) => {
      if (isDropSet) {
        const historySeed = getWeightSeed(lastLog, i, unit, 'drop');
        const sourceStages = explicitStages
          || historySeed?.dropStages
          || makeDefaultDropStages(unit);
        const matchingHistory = historySeed?.dropStages?.length === sourceStages.length
          ? historySeed.dropStages
          : undefined;
        const currentStages = sourceStages.map((stage, stageIndex) => ({
          ...stage,
          id: `s-${sessionId}-${exIdx}-${i}-stage-${stageIndex + 1}`,
          unit,
          weightOrPlates: unit === 'bodyweight' || stage.unit !== unit
            ? 0
            : (matchingHistory?.[stageIndex].weightOrPlates ?? stage.weightOrPlates),
          reps: 0,
        }));

        return {
          id: `s-${sessionId}-${exIdx}-${i}`,
          setNumber: i + 1,
          unit,
          weightOrPlates: currentStages[0]?.weightOrPlates ?? 0,
          reps: 0,
          completed: false,
          pulleyRatio: newSessionPulleyRatio(),
          isDropSet: true,
          dropStages: currentStages,
        };
      }

      const mode: WorkoutSetMode = isUnilateral ? 'unilateral' : 'standard';
      const historySeed = getWeightSeed(lastLog, i, unit, mode);
      const plannedWeight = pe.targetWeight !== undefined
        ? (unit === 'bodyweight' ? 0 : pe.targetWeight)
        : undefined;

      if (isUnilateral) {
        const leftWeight = historySeed?.left?.weight ?? plannedWeight ?? 0;
        const rightWeight = historySeed?.right?.weight ?? plannedWeight ?? 0;
        return {
          id: `s-${sessionId}-${exIdx}-${i}`,
          setNumber: i + 1,
          unit,
          // 主字段为左侧副本，供不支持分侧的旧逻辑/概览读取
          weightOrPlates: leftWeight,
          reps: 0,
          completed: false,
          pulleyRatio: newSessionPulleyRatio(),
          unilateral: true,
          left: { weight: leftWeight, reps: 0 },
          right: { weight: rightWeight, reps: 0 },
        };
      }

      return {
        id: `s-${sessionId}-${exIdx}-${i}`,
        setNumber: i + 1,
        unit,
        weightOrPlates: historySeed?.weightOrPlates ?? plannedWeight ?? 0,
        reps: 0,
        completed: false,
        pulleyRatio: newSessionPulleyRatio(),
      };
    });

    return {
      exerciseId: pe.exerciseId,
      exerciseName: exDetail?.name || '未知动作',
      category: exDetail?.category || 'chest',
      pulleyRatio: newSessionPulleyRatio(),
      currentUnit: unit,
      isUnilateral: isUnilateral || undefined,
      sets,
      notes: pe.notes || ''
    };
  });

  return {
    id: sessionId,
    date: todayLocalDate(),
    planId: plan.id,
    planName: plan.name,
    startTime: Date.now(),
    exercises: exerciseLogs,
    ...newSessionCardioDefaults(),
  };
}
