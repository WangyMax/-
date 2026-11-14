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
  // 左右独立动作：双臂/双腿独立器械，训练时左右分别记录重量与次数
  isUnilateral?: boolean;
  // 递减超级组标记：在动作库勾选后，该动作默认按超级组编排（与单侧互斥）
  isDropSet?: boolean;
  // 预设递减阶梯（与 PlanExerciseTarget.dropStages 同构，例如 10kg/12次 -> 7.5kg/12次 -> 5kg/10次 -> 2.5kg/12次）
  dropStages?: DropStage[];
  notes?: string;
}

export interface UnilateralSide {
  weight: number; // 单侧重量/片数
  reps: number;   // 单侧次数
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
  isUnilateral?: boolean; // 左右独立：开练时该动作左右分别记录
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
  // 左右独立记录（普通组）：左右重量次数可不同；超级组阶梯暂不支持分侧
  unilateral?: boolean;
  left?: UnilateralSide;
  right?: UnilateralSide;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  category: MuscleCategory;
  pulleyRatio: PulleyRatio;
  currentUnit: ResistanceUnit;
  // 左右独立：该动作的组按左右分别记录
  isUnilateral?: boolean;
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
  isAutoRest?: boolean; // 是否为「未训练日自动记为休息」派生的虚拟记录（不落盘）
  restType?: 'full_rest' | 'active_recovery' | 'busy_or_unwell'; // 休息恢复类型
}

export interface WeightLog {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // kg
  timeSlot?: 'morning' | 'evening' | 'post-workout';
  note: string; // e.g. "晚上吃了鸡公煲"
}

// ===================== 用药管理（服药记录与提醒） =====================
// 场景：隔天一次（48h）的长期用药（非那雄胺），需要按固定节律提醒并留档。
// 设计要点：槽位日（slotDate）从 startDate 起按 intervalHours 整日递推，
// 与实际打卡时刻无关——保证“隔天同一时刻”的节律稳定，迟到记录不会把周期越拖越乱。
export type MedicationDoseStatus = 'taken' | 'skipped';

export interface MedicationConfig {
  /** 药品名，如“非那雄胺” */
  name: string;
  /** 剂量说明，如“1 mg” */
  dosage: string;
  /** 服药间隔小时数（24=每天 / 48=隔天 / 72=每3天），按整天递推 */
  intervalHours: number;
  /** 每日提醒时刻 HH:mm（本地时间） */
  reminderTime: string;
  /** 提醒总开关：关闭后不再排期系统通知 */
  reminderEnabled: boolean;
  /** 周期锚点：首剂应服日 YYYY-MM-DD */
  startDate: string;
  notes?: string;
}

export interface MedicationDose {
  id: string;
  /** 对应的规划槽位日 YYYY-MM-DD */
  slotDate: string;
  /** 实际打卡时间戳（ms） */
  takenAt: number;
  /** taken=已服用；skipped=本次跳过（顺延到下一槽位，不计漏服） */
  status: MedicationDoseStatus;
  note?: string;
}

// 分类只保留文案：颜色由设计系统的中性 Badge 统一承担，避免色相与状态色语义冲突
export const CATEGORY_LABELS: Record<MuscleCategory, { label: string }> = {
  chest: { label: '胸部' },
  back: { label: '背部' },
  shoulder: { label: '肩部' },
  leg: { label: '腿部' },
  biceps: { label: '肱二头' },
  triceps: { label: '肱三头' },
  abs: { label: '腹部核心' },
  cardio: { label: '有氧训练' },
};

export const UNIT_LABELS: Record<ResistanceUnit, string> = {
  kg: '重量 (kg)',
  plates: '插销 (片)',
  bodyweight: '自重',
  assisted: '助力 (kg)',
};

// 动作部位的规范展示顺序（与动作库筛选条一致），
// 用于动作库读取时的稳定归一化排序：自定义动作归入同类分组末尾。
export const CATEGORY_ORDER: MuscleCategory[] = [
  'chest',
  'back',
  'shoulder',
  'leg',
  'biceps',
  'triceps',
  'abs',
  'cardio',
];
