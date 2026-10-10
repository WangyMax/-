export type MuscleCategory = 
  | 'chest' 
  | 'back' 
  | 'shoulder' 
  | 'leg' 
  | 'biceps' 
  | 'triceps' 
  | 'abs' 
  | 'cardio';

export type ResistanceUnit = 'kg' | 'plates' | 'bodyweight' | 'assisted';

export type PulleyRatio = 'none' | '1:1' | '2:1';

export interface Exercise {
  id: string;
  name: string;
  category: MuscleCategory;
  defaultUnit: ResistanceUnit;
  defaultPulley?: PulleyRatio;
  isFavorite?: boolean;
  isCustom?: boolean;
  notes?: string;
}

export interface DropStage {
  id: string;
  weightOrPlates: number;
  unit: ResistanceUnit;
  reps: number;
}

export interface PlanExerciseTarget {
  exerciseId: string;
  targetSets: number; // 大组数 (例如 4 个大组)
  targetReps?: number;
  targetWeight?: number; // 预设目标重量或片数
  targetUnit?: ResistanceUnit; // 预设阻力单位：kg / plates / assisted / bodyweight
  pulleyRatio?: PulleyRatio; // 预设滑轮比例：none / 1:1 / 2:1
  isDropSet?: boolean; // 是否开启递减超级组
  dropStages?: DropStage[]; // 预设递减阶梯 (例如: 10kg/12次 -> 7.5kg/12次 -> 5kg/10次 -> 2.5kg/12次)
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  categoryTags: string[]; // e.g. ["胸", "三头"]
  description: string;
  exercises: PlanExerciseTarget[];
  cardioMinutes: number; // e.g. 20, 0 for none
  cardioType?: string;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  unit: ResistanceUnit;
  weightOrPlates: number; // e.g. 50 kg or 12 片
  reps: number;
  completed: boolean;
  pulleyRatio?: PulleyRatio;
  rpe?: number;
  // 递减超级组支持：
  isDropSet?: boolean;
  dropStages?: DropStage[]; // 递减阶梯详情（如 10kg/12次 -> 7.5kg/12次 -> 5kg/10次 -> 2.5kg/12次）
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  category: MuscleCategory;
  pulleyRatio: PulleyRatio;
  currentUnit: ResistanceUnit;
  sets: WorkoutSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  planId?: string;
  planName: string;
  startTime: number;
  endTime?: number;
  exercises: ExerciseLog[];
  cardioMinutes: number;
  cardioCompleted: boolean;
  cardioType?: string;
  cardioNotes?: string;
  notes?: string;
  isRestDay?: boolean; // 是否为休息日打卡
  restType?: 'full_rest' | 'active_recovery' | 'busy_or_unwell'; // 休息恢复类型
}

export interface WeightLog {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // kg
  timeSlot?: 'morning' | 'evening' | 'post-workout';
  note: string; // e.g. "晚上吃了鸡公煲"
}

export const CATEGORY_LABELS: Record<MuscleCategory, { label: string; color: string; bg: string }> = {
  chest: { label: '胸部', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  back: { label: '背部', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  shoulder: { label: '肩部', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  leg: { label: '腿部', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  biceps: { label: '肱二头', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  triceps: { label: '肱三头', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  abs: { label: '腹部核心', color: 'text-yellow-800', bg: 'bg-yellow-50 border-yellow-200' },
  cardio: { label: '有氧训练', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
};

export const UNIT_LABELS: Record<ResistanceUnit, string> = {
  kg: '重量 (kg)',
  plates: '插销 (片)',
  bodyweight: '自重',
  assisted: '助力 (kg)',
};
