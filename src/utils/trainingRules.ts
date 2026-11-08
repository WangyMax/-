import type {
  DropStage,
  PulleyRatio,
  ResistanceUnit,
  UnilateralSide,
  WorkoutSet,
} from '../types';

export type WorkoutSetMode = 'standard' | 'unilateral' | 'drop';

export interface WorkoutCardioDefaults {
  cardioMinutes: number;
  cardioCompleted: boolean;
  cardioType?: string;
  cardioNotes?: string;
}

export interface WorkoutWeightSeed {
  weightOrPlates: number;
  left?: UnilateralSide;
  right?: UnilateralSide;
  dropStages?: DropStage[];
}

export function newSessionCardioDefaults(): WorkoutCardioDefaults {
  return {
    cardioMinutes: 0,
    cardioCompleted: false,
    cardioType: undefined,
    cardioNotes: undefined,
  };
}

export function newSessionPulleyRatio(): PulleyRatio {
  return 'none';
}

export function normalizePulleyForUnit(
  unit: ResistanceUnit,
  ratio: PulleyRatio | undefined,
): PulleyRatio {
  return unit === 'bodyweight' || !ratio ? 'none' : ratio;
}

export function requiresWeightInput(unit: ResistanceUnit): boolean {
  return unit !== 'bodyweight';
}

function hasMode(set: WorkoutSet, mode: WorkoutSetMode): boolean {
  if (mode === 'drop') return Boolean(set.isDropSet);
  if (mode === 'unilateral') return Boolean(set.unilateral) && !set.isDropSet;
  return !set.unilateral && !set.isDropSet;
}

// Seeds copied between sets intentionally include weights only. Repetitions
// must always be entered for the current workout.
export function seedWeightsOnly(
  source: WorkoutSet | undefined,
  unit: ResistanceUnit,
  mode: WorkoutSetMode,
): WorkoutWeightSeed | null {
  if (!source || source.unit !== unit || !hasMode(source, mode)) return null;
  if (mode === 'drop' && source.dropStages?.some(stage => stage.unit !== unit)) return null;

  if (unit === 'bodyweight') {
    return {
      weightOrPlates: 0,
      left: mode === 'unilateral' ? { weight: 0, reps: 0 } : undefined,
      right: mode === 'unilateral' ? { weight: 0, reps: 0 } : undefined,
      dropStages: mode === 'drop'
        ? (source.dropStages || []).map(stage => ({
            ...stage,
            weightOrPlates: 0,
            unit,
            reps: 0,
          }))
        : undefined,
    };
  }

  if (mode === 'drop') {
    return {
      weightOrPlates: source.dropStages?.[0]?.weightOrPlates ?? 0,
      dropStages: (source.dropStages || []).map(stage => ({
        ...stage,
        unit,
        reps: 0,
      })),
    };
  }

  if (mode === 'unilateral') {
    const leftWeight = source.left?.weight ?? source.weightOrPlates ?? 0;
    const rightWeight = source.right?.weight ?? source.weightOrPlates ?? 0;
    return {
      weightOrPlates: leftWeight,
      left: { weight: leftWeight, reps: 0 },
      right: { weight: rightWeight, reps: 0 },
    };
  }

  return {
    weightOrPlates: source.weightOrPlates,
  };
}

export function validateWorkoutSetForCompletion(set: WorkoutSet): string | null {
  if (set.isDropSet) {
    if (!set.dropStages?.length) return '请先配置递减阶梯';
    if (set.dropStages.some(stage => !Number.isFinite(stage.reps) || stage.reps <= 0)) {
      return '请填写每一阶次数后再完成';
    }
    return null;
  }

  if (set.unilateral) {
    if (!set.left || !set.right) return '请先填写左右次数';
    if (
      !Number.isFinite(set.left.reps)
      || set.left.reps <= 0
      || !Number.isFinite(set.right.reps)
      || set.right.reps <= 0
    ) {
      return '请填写左右两侧次数后再完成';
    }
    return null;
  }

  return Number.isFinite(set.reps) && set.reps > 0 ? null : '请填写次数后再完成';
}

export function formatCurrentUnit(unit: ResistanceUnit): string {
  if (unit === 'plates') return '片';
  if (unit === 'assisted') return 'kg 助力';
  return unit === 'bodyweight' ? '自重' : 'kg';
}

function formatLoad(weight: number, unit: ResistanceUnit): string | null {
  if (!requiresWeightInput(unit) || !Number.isFinite(weight) || weight <= 0) return null;
  return `${weight}${formatCurrentUnit(unit)}`;
}

export function formatWorkoutSetSummary(set: WorkoutSet): string {
  if (set.isDropSet) return formatDropStagesSummary(set.dropStages || []);
  const reps = set.reps > 0 ? `${set.reps}次` : '次数待填';
  if (set.unilateral && set.left && set.right) {
    const leftLoad = formatLoad(set.left.weight, set.unit);
    const rightLoad = formatLoad(set.right.weight, set.unit);
    const leftReps = set.left.reps > 0 ? `${set.left.reps}次` : '次数待填';
    const rightReps = set.right.reps > 0 ? `${set.right.reps}次` : '次数待填';
    return `左${leftLoad ? `${leftLoad}，` : ''}${leftReps} / 右${rightLoad ? `${rightLoad}，` : ''}${rightReps}`;
  }

  const load = formatLoad(set.weightOrPlates, set.unit);
  if (set.unit === 'bodyweight') return `自重 ${reps}`;
  return load ? `${load}，${reps}` : reps;
}

export function formatDropStagesSummary(stages: DropStage[]): string {
  return stages
    .map((stage) => {
      const load = formatLoad(stage.weightOrPlates, stage.unit);
      const reps = stage.reps > 0 ? `${stage.reps}次` : '次数待填';
      return load ? `${load}，${reps}` : `${stage.unit === 'bodyweight' ? '自重 ' : ''}${reps}`;
    })
    .join(' → ');
}
