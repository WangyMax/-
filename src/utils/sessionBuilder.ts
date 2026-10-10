import {
  WorkoutPlan, WorkoutSession, ExerciseLog, WorkoutSet,
  ResistanceUnit, PulleyRatio, Exercise,
} from '../types';
import { StorageService } from './storage';

// 由训练计划一键构建进行中的会话。
// 统一供 WorkoutView 与 App（计划页一键开练）使用，
// 保证超级组阶梯预设与上次训练参考数据在两条入口注入一致。
export function buildSessionFromPlan(
  plan: WorkoutPlan,
  allExercises: Exercise[],
): WorkoutSession {
  const exerciseLogs: ExerciseLog[] = plan.exercises.map((pe, exIdx) => {
    const exDetail = allExercises.find(e => e.id === pe.exerciseId);
    const lastLog = StorageService.getLastExerciseLog(pe.exerciseId);

    const unit: ResistanceUnit = pe.targetUnit || exDetail?.defaultUnit || 'kg';
    const pulley: PulleyRatio = pe.pulleyRatio || exDetail?.defaultPulley || 'none';
    const isDropSet = Boolean(pe.isDropSet || (pe.dropStages && pe.dropStages.length > 0));

    const baseDropStages = pe.dropStages && pe.dropStages.length > 0
      ? JSON.parse(JSON.stringify(pe.dropStages))
      : [
          { id: 'stg-1', weightOrPlates: 10, unit: 'kg' as ResistanceUnit, reps: 12 },
          { id: 'stg-2', weightOrPlates: 7.5, unit: 'kg' as ResistanceUnit, reps: 12 },
          { id: 'stg-3', weightOrPlates: 5, unit: 'kg' as ResistanceUnit, reps: 10 },
          { id: 'stg-4', weightOrPlates: 2.5, unit: 'kg' as ResistanceUnit, reps: 12 },
        ];

    const sets: WorkoutSet[] = Array.from({ length: pe.targetSets || 4 }, (_, i) => {
      const lastSet = lastLog?.sets[i];

      if (isDropSet) {
        const currentStages = lastSet?.dropStages && lastSet.dropStages.length > 0
          ? JSON.parse(JSON.stringify(lastSet.dropStages))
          : JSON.parse(JSON.stringify(baseDropStages));

        return {
          id: `s-${Date.now()}-${exIdx}-${i}`,
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
        id: `s-${Date.now()}-${exIdx}-${i}`,
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

  return {
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
}
