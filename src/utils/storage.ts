import { Exercise, WorkoutPlan, WorkoutSession, WeightLog, ExerciseLog } from '../types';
import { INITIAL_EXERCISES } from '../data/initialExercises';
import { INITIAL_PLANS } from '../data/initialPlans';

const STORAGE_KEYS = {
  EXERCISES: 'fitcustom_exercises_v2',
  PLANS: 'fitcustom_plans_v2',
  SESSIONS: 'fitcustom_sessions_v2',
  WEIGHTS: 'fitcustom_weights_v2',
  ACTIVE_SESSION: 'fitcustom_active_session_v2',
  REST_TIMER: 'fitcustom_rest_timer_v2',
  // 旧版本键名，用于自动迁移
  OLD_SESSIONS: 'fitcustom_sessions_v1',
  OLD_WEIGHTS: 'fitcustom_weights_v1',
  OLD_PLANS: 'fitcustom_plans_v1',
  OLD_EXERCISES: 'fitcustom_exercises_v1',
};

// 预填充真实历史体重记录 (来自用户的真实记录)
export const INITIAL_WEIGHTS: WeightLog[] = [
  {
    id: 'w-real-03',
    date: '2026-10-09',
    weight: 63.3,
    timeSlot: 'morning',
    note: '腿日晨起称重，准备冲刺深蹲'
  },
  {
    id: 'w-real-02',
    date: '2026-10-08',
    weight: 64.1,
    timeSlot: 'morning',
    note: '肩日晨起打卡'
  },
  {
    id: 'w-real-01',
    date: '2026-10-07',
    weight: 63.2,
    timeSlot: 'evening',
    note: '晚上吃了鸡公煲'
  },
  {
    id: 'w-real-00',
    date: '2026-10-06',
    weight: 63.5,
    timeSlot: 'morning',
    note: '胸日晨起空腹称重'
  }
];

// 预填充真实 10.06 - 10.09 训练记录 (来自用户的真实记录文档)
export const INITIAL_SESSIONS: WorkoutSession[] = [
  // 10月09日: 腿
  {
    id: 'sess-real-1009',
    date: '2026-10-09',
    planId: 'plan-leg-focus',
    planName: '腿部专注 (深蹲日)',
    startTime: new Date('2026-10-09 18:30:00').getTime(),
    endTime: new Date('2026-10-09 19:50:00').getTime(),
    cardioMinutes: 0,
    cardioCompleted: false,
    cardioType: '无',
    notes: '下肢轰炸日，哈克深蹲与倒蹬全力推进，腿部完全力竭，不安排有氧',
    exercises: [
      {
        exerciseId: 'ex-leg-01',
        exerciseName: '哈克深蹲',
        category: 'leg',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1009-1-1', setNumber: 1, unit: 'kg', weightOrPlates: 90, reps: 8, completed: true },
          { id: 's1009-1-2', setNumber: 2, unit: 'kg', weightOrPlates: 90, reps: 8, completed: true },
          { id: 's1009-1-3', setNumber: 3, unit: 'kg', weightOrPlates: 90, reps: 8, completed: true },
          { id: 's1009-1-4', setNumber: 4, unit: 'kg', weightOrPlates: 90, reps: 8, completed: true },
        ]
      },
      {
        exerciseId: 'ex-leg-02',
        exerciseName: '倒蹬 (器械腿举)',
        category: 'leg',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1009-2-1', setNumber: 1, unit: 'kg', weightOrPlates: 90, reps: 12, completed: true },
          { id: 's1009-2-2', setNumber: 2, unit: 'kg', weightOrPlates: 90, reps: 12, completed: true },
          { id: 's1009-2-3', setNumber: 3, unit: 'kg', weightOrPlates: 90, reps: 12, completed: true },
          { id: 's1009-2-4', setNumber: 4, unit: 'kg', weightOrPlates: 90, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-leg-03',
        exerciseName: '腿屈伸',
        category: 'leg',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1009-3-1', setNumber: 1, unit: 'kg', weightOrPlates: 45, reps: 10, completed: true },
          { id: 's1009-3-2', setNumber: 2, unit: 'kg', weightOrPlates: 45, reps: 12, completed: true },
          { id: 's1009-3-3', setNumber: 3, unit: 'kg', weightOrPlates: 45, reps: 12, completed: true },
          { id: 's1009-3-4', setNumber: 4, unit: 'kg', weightOrPlates: 45, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-leg-04',
        exerciseName: '内收肌夹腿',
        category: 'leg',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1009-4-1', setNumber: 1, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
          { id: 's1009-4-2', setNumber: 2, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
          { id: 's1009-4-3', setNumber: 3, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
          { id: 's1009-4-4', setNumber: 4, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-leg-05',
        exerciseName: '俯身腿弯举',
        category: 'leg',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1009-5-1', setNumber: 1, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1009-5-2', setNumber: 2, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1009-5-3', setNumber: 3, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1009-5-4', setNumber: 4, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
        ]
      }
    ]
  },

  // 10月08日: 肩
  {
    id: 'sess-real-1008',
    date: '2026-10-08',
    planId: 'plan-shoulder-abs',
    planName: '肩 ➕ 腹部',
    startTime: new Date('2026-10-08 19:00:00').getTime(),
    endTime: new Date('2026-10-08 20:25:00').getTime(),
    cardioMinutes: 20,
    cardioCompleted: true,
    cardioType: '跑步机坡度快走',
    cardioNotes: '附加20分钟有氧快走，暴汗',
    notes: '超级组飞鸟递减泵感极强，反向飞鸟双滑轮30kg后束发力清晰',
    exercises: [
      {
        exerciseId: 'ex-sho-02',
        exerciseName: '反向飞鸟 (双滑轮)',
        category: 'shoulder',
        pulleyRatio: '2:1',
        currentUnit: 'kg',
        sets: [
          { id: 's1008-1-1', setNumber: 1, unit: 'kg', weightOrPlates: 30, reps: 10, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-1-2', setNumber: 2, unit: 'kg', weightOrPlates: 30, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-1-3', setNumber: 3, unit: 'kg', weightOrPlates: 30, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-1-4', setNumber: 4, unit: 'kg', weightOrPlates: 30, reps: 8, completed: true, pulleyRatio: '2:1' },
        ]
      },
      {
        exerciseId: 'ex-sho-01',
        exerciseName: '推肩',
        category: 'shoulder',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1008-2-1', setNumber: 1, unit: 'kg', weightOrPlates: 20, reps: 8, completed: true },
          { id: 's1008-2-2', setNumber: 2, unit: 'kg', weightOrPlates: 20, reps: 8, completed: true },
          { id: 's1008-2-3', setNumber: 3, unit: 'kg', weightOrPlates: 20, reps: 8, completed: true },
          { id: 's1008-2-4', setNumber: 4, unit: 'kg', weightOrPlates: 20, reps: 8, completed: true },
        ]
      },
      {
        exerciseId: 'ex-sho-03',
        exerciseName: '超级组飞鸟 (侧平举)',
        category: 'shoulder',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        notes: '超级组递减: 10kg(12/10/8/8) ➔ 7.5kg(12/10/8/8) ➔ 5kg(10/10/8/8) ➔ 2.5kg(12/8/8/8)',
        sets: [
          { id: 's1008-3-1', setNumber: 1, unit: 'kg', weightOrPlates: 10, reps: 12, completed: true },
          { id: 's1008-3-2', setNumber: 2, unit: 'kg', weightOrPlates: 10, reps: 10, completed: true },
          { id: 's1008-3-3', setNumber: 3, unit: 'kg', weightOrPlates: 10, reps: 8, completed: true },
          { id: 's1008-3-4', setNumber: 4, unit: 'kg', weightOrPlates: 10, reps: 8, completed: true },
          { id: 's1008-3-5', setNumber: 5, unit: 'kg', weightOrPlates: 7.5, reps: 12, completed: true },
          { id: 's1008-3-6', setNumber: 6, unit: 'kg', weightOrPlates: 7.5, reps: 10, completed: true },
          { id: 's1008-3-7', setNumber: 7, unit: 'kg', weightOrPlates: 7.5, reps: 8, completed: true },
          { id: 's1008-3-8', setNumber: 8, unit: 'kg', weightOrPlates: 7.5, reps: 8, completed: true },
          { id: 's1008-3-9', setNumber: 9, unit: 'kg', weightOrPlates: 5, reps: 10, completed: true },
          { id: 's1008-3-10', setNumber: 10, unit: 'kg', weightOrPlates: 5, reps: 10, completed: true },
          { id: 's1008-3-11', setNumber: 11, unit: 'kg', weightOrPlates: 5, reps: 8, completed: true },
          { id: 's1008-3-12', setNumber: 12, unit: 'kg', weightOrPlates: 5, reps: 8, completed: true },
          { id: 's1008-3-13', setNumber: 13, unit: 'kg', weightOrPlates: 2.5, reps: 12, completed: true },
          { id: 's1008-3-14', setNumber: 14, unit: 'kg', weightOrPlates: 2.5, reps: 8, completed: true },
          { id: 's1008-3-15', setNumber: 15, unit: 'kg', weightOrPlates: 2.5, reps: 8, completed: true },
          { id: 's1008-3-16', setNumber: 16, unit: 'kg', weightOrPlates: 2.5, reps: 8, completed: true },
        ]
      },
      {
        exerciseId: 'ex-sho-04',
        exerciseName: '前平举',
        category: 'shoulder',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1008-4-1', setNumber: 1, unit: 'kg', weightOrPlates: 5, reps: 12, completed: true },
          { id: 's1008-4-2', setNumber: 2, unit: 'kg', weightOrPlates: 5, reps: 12, completed: true },
          { id: 's1008-4-3', setNumber: 3, unit: 'kg', weightOrPlates: 5, reps: 12, completed: true },
          { id: 's1008-4-4', setNumber: 4, unit: 'kg', weightOrPlates: 5, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-sho-05',
        exerciseName: 'Y 举',
        category: 'shoulder',
        pulleyRatio: '2:1',
        currentUnit: 'plates',
        sets: [
          { id: 's1008-5-1', setNumber: 1, unit: 'plates', weightOrPlates: 1, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-5-2', setNumber: 2, unit: 'plates', weightOrPlates: 1, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-5-3', setNumber: 3, unit: 'plates', weightOrPlates: 1, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's1008-5-4', setNumber: 4, unit: 'plates', weightOrPlates: 1, reps: 12, completed: true, pulleyRatio: '2:1' },
        ]
      }
    ]
  },

  // 10月07日: 背
  {
    id: 'sess-real-1007',
    date: '2026-10-07',
    planId: 'plan-back-biceps',
    planName: '背 ➕ 二头',
    startTime: new Date('2026-10-07 19:00:00').getTime(),
    endTime: new Date('2026-10-07 20:15:00').getTime(),
    cardioMinutes: 20,
    cardioCompleted: true,
    cardioType: '跑步机坡度快走',
    cardioNotes: '附加20分钟有氧快走',
    notes: '引体向上助力保持高专注度，窄距划船15片背阔肌发力充分',
    exercises: [
      {
        exerciseId: 'ex-back-01',
        exerciseName: '引体向上 (助力)',
        category: 'back',
        pulleyRatio: 'none',
        currentUnit: 'assisted',
        sets: [
          { id: 's1007-1-1', setNumber: 1, unit: 'assisted', weightOrPlates: 30, reps: 12, completed: true },
          { id: 's1007-1-2', setNumber: 2, unit: 'assisted', weightOrPlates: 30, reps: 12, completed: true },
          { id: 's1007-1-3', setNumber: 3, unit: 'assisted', weightOrPlates: 30, reps: 12, completed: true },
          { id: 's1007-1-4', setNumber: 4, unit: 'assisted', weightOrPlates: 30, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-back-02',
        exerciseName: '窄距划船 (器械/绳索)',
        category: 'back',
        pulleyRatio: '1:1',
        currentUnit: 'plates',
        sets: [
          { id: 's1007-2-1', setNumber: 1, unit: 'plates', weightOrPlates: 15, reps: 12, completed: true, pulleyRatio: '1:1' },
          { id: 's1007-2-2', setNumber: 2, unit: 'plates', weightOrPlates: 15, reps: 12, completed: true, pulleyRatio: '1:1' },
          { id: 's1007-2-3', setNumber: 3, unit: 'plates', weightOrPlates: 15, reps: 12, completed: true, pulleyRatio: '1:1' },
          { id: 's1007-2-4', setNumber: 4, unit: 'plates', weightOrPlates: 15, reps: 11, completed: true, pulleyRatio: '1:1' },
        ]
      },
      {
        exerciseId: 'ex-back-03',
        exerciseName: '反手高位下拉',
        category: 'back',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1007-3-1', setNumber: 1, unit: 'kg', weightOrPlates: 40, reps: 9, completed: true },
          { id: 's1007-3-2', setNumber: 2, unit: 'kg', weightOrPlates: 40, reps: 11, completed: true },
          { id: 's1007-3-3', setNumber: 3, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
          { id: 's1007-3-4', setNumber: 4, unit: 'kg', weightOrPlates: 40, reps: 9, completed: true },
        ]
      },
      {
        exerciseId: 'ex-back-04',
        exerciseName: '单臂器械划船',
        category: 'back',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1007-4-1', setNumber: 1, unit: 'kg', weightOrPlates: 25, reps: 8, completed: true },
          { id: 's1007-4-2', setNumber: 2, unit: 'kg', weightOrPlates: 25, reps: 8, completed: true },
          { id: 's1007-4-3', setNumber: 3, unit: 'kg', weightOrPlates: 25, reps: 8, completed: true },
          { id: 's1007-4-4', setNumber: 4, unit: 'kg', weightOrPlates: 25, reps: 8, completed: true },
        ]
      }
    ]
  },

  // 10月06日: 胸
  {
    id: 'sess-real-1006',
    date: '2026-10-06',
    planId: 'plan-chest-triceps',
    planName: '胸 ➕ 三头',
    startTime: new Date('2026-10-06 18:30:00').getTime(),
    endTime: new Date('2026-10-06 19:40:00').getTime(),
    cardioMinutes: 20,
    cardioCompleted: true,
    cardioType: '跑步机坡度快走',
    cardioNotes: '附加20分钟有氧快走',
    notes: '状态不错，蝴蝶机夹胸充分激活，卧推推胸有力',
    exercises: [
      {
        exerciseId: 'ex-chest-01',
        exerciseName: '蝴蝶机夹胸（前）',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1006-1-1', setNumber: 1, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1006-1-2', setNumber: 2, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1006-1-3', setNumber: 3, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
          { id: 's1006-1-4', setNumber: 4, unit: 'kg', weightOrPlates: 35, reps: 12, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-02',
        exerciseName: '卧推',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1006-2-1', setNumber: 1, unit: 'kg', weightOrPlates: 60, reps: 12, completed: true },
          { id: 's1006-2-2', setNumber: 2, unit: 'kg', weightOrPlates: 60, reps: 12, completed: true },
          { id: 's1006-2-3', setNumber: 3, unit: 'kg', weightOrPlates: 60, reps: 12, completed: true },
          { id: 's1006-2-4', setNumber: 4, unit: 'kg', weightOrPlates: 60, reps: 11, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-03',
        exerciseName: '上斜固定推胸',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1006-3-1', setNumber: 1, unit: 'kg', weightOrPlates: 35, reps: 9, completed: true },
          { id: 's1006-3-2', setNumber: 2, unit: 'kg', weightOrPlates: 35, reps: 9, completed: true },
          { id: 's1006-3-3', setNumber: 3, unit: 'kg', weightOrPlates: 35, reps: 8, completed: true },
          { id: 's1006-3-4', setNumber: 4, unit: 'kg', weightOrPlates: 35, reps: 7, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-04',
        exerciseName: '固定推中胸',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1006-4-1', setNumber: 1, unit: 'kg', weightOrPlates: 50, reps: 10, completed: true },
          { id: 's1006-4-2', setNumber: 2, unit: 'kg', weightOrPlates: 50, reps: 10, completed: true },
          { id: 's1006-4-3', setNumber: 3, unit: 'kg', weightOrPlates: 50, reps: 8, completed: true },
          { id: 's1006-4-4', setNumber: 4, unit: 'kg', weightOrPlates: 50, reps: 9, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-05',
        exerciseName: '下胸器械推胸',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'plates',
        sets: [
          { id: 's1006-5-1', setNumber: 1, unit: 'plates', weightOrPlates: 10, reps: 10, completed: true },
          { id: 's1006-5-2', setNumber: 2, unit: 'plates', weightOrPlates: 10, reps: 10, completed: true },
          { id: 's1006-5-3', setNumber: 3, unit: 'plates', weightOrPlates: 10, reps: 10, completed: true },
          { id: 's1006-5-4', setNumber: 4, unit: 'plates', weightOrPlates: 10, reps: 10, completed: true },
        ]
      }
    ]
  }
];

export const StorageService = {
  // 动作库
  getExercises(): Exercise[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EXERCISES);
    if (!raw) {
      // 检查旧版本数据
      const oldRaw = localStorage.getItem(STORAGE_KEYS.OLD_EXERCISES);
      let list = INITIAL_EXERCISES;
      if (oldRaw) {
        try {
          const oldList: Exercise[] = JSON.parse(oldRaw);
          // 保留旧版本的用户自定义动作
          const customOnes = oldList.filter(e => e.isCustom);
          list = [...INITIAL_EXERCISES, ...customOnes];
        } catch {
          // ignore
        }
      }
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(list));
      return list;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EXERCISES;
    }
  },

  saveExercises(exercises: Exercise[]): void {
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
  },

  toggleFavorite(exerciseId: string): void {
    const list = this.getExercises();
    const ex = list.find(e => e.id === exerciseId);
    if (ex) {
      ex.isFavorite = !ex.isFavorite;
      this.saveExercises(list);
    }
  },

  updateExerciseUnit(exerciseId: string, unit: Exercise['defaultUnit'], pulley?: Exercise['defaultPulley']): void {
    const list = this.getExercises();
    const ex = list.find(e => e.id === exerciseId);
    if (ex) {
      ex.defaultUnit = unit;
      if (pulley !== undefined) ex.defaultPulley = pulley;
      this.saveExercises(list);
    }
  },

  addCustomExercise(exercise: Omit<Exercise, 'id' | 'isCustom'>): Exercise {
    const all = this.getExercises();
    const newEx: Exercise = {
      ...exercise,
      id: `ex-custom-${Date.now()}`,
      isCustom: true,
    };
    all.unshift(newEx);
    this.saveExercises(all);
    return newEx;
  },

  // 计划库
  getPlans(): WorkoutPlan[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (!raw) {
      // 初始化为包含完整重量预设的四大计划
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(INITIAL_PLANS));
      return INITIAL_PLANS;
    }
    try {
      const parsed: WorkoutPlan[] = JSON.parse(raw);
      // 确保4大计划中的关键预设属性与 INITIAL_PLANS 同步升级（若缺少 targetWeight）
      let hasChanges = false;
      const updated = parsed.map(plan => {
        const initMatch = INITIAL_PLANS.find(p => p.id === plan.id);
        if (initMatch && (!plan.exercises[0]?.targetWeight)) {
          hasChanges = true;
          return {
            ...plan,
            exercises: plan.exercises.map((ex, idx) => {
              const initEx = initMatch.exercises[idx];
              return {
                ...ex,
                targetWeight: ex.targetWeight ?? initEx?.targetWeight,
                targetUnit: ex.targetUnit ?? initEx?.targetUnit,
                pulleyRatio: ex.pulleyRatio ?? initEx?.pulleyRatio,
              };
            })
          };
        }
        return plan;
      });
      if (hasChanges) {
        localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    } catch {
      return INITIAL_PLANS;
    }
  },

  savePlans(plans: WorkoutPlan[]): void {
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  },

  savePlan(plan: WorkoutPlan): void {
    const plans = this.getPlans();
    const index = plans.findIndex(p => p.id === plan.id);
    if (index >= 0) {
      plans[index] = plan;
    } else {
      plans.push(plan);
    }
    this.savePlans(plans);
  },

  deletePlan(planId: string): void {
    const plans = this.getPlans().filter(p => p.id !== planId);
    this.savePlans(plans);
  },

  // 训练记录
  getSessions(): WorkoutSession[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    let sessions: WorkoutSession[] = [];
    if (!raw) {
      // 迁移检查：如果有旧版本，先合并旧版本的自定义会话，并且补齐 10.06 - 10.09 真实记录
      const oldRaw = localStorage.getItem(STORAGE_KEYS.OLD_SESSIONS);
      sessions = [...INITIAL_SESSIONS];
      if (oldRaw) {
        try {
          const oldSessions: WorkoutSession[] = JSON.parse(oldRaw);
          for (const s of oldSessions) {
            // 如果不是这4个日期的会话，保留用户的历史
            if (!['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].includes(s.date)) {
              sessions.push(s);
            }
          }
        } catch {
          // ignore
        }
      }
      // 按日期降序
      sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return sessions;
    }

    try {
      sessions = JSON.parse(raw);
    } catch {
      sessions = [...INITIAL_SESSIONS];
    }

    // 安全检查：如果本地记录中缺少 10.06 - 10.09 中的任何一项真实记录，自动补充合并进去
    const missingRealSessions = INITIAL_SESSIONS.filter(
      initSess => !sessions.some(s => s.date === initSess.date && s.exercises.length > 0)
    );
    if (missingRealSessions.length > 0) {
      sessions = [...sessions, ...missingRealSessions];
      sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    }

    return sessions;
  },

  saveSessions(sessions: WorkoutSession[]): void {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  addSession(session: WorkoutSession): void {
    const sessions = this.getSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    // 按日期降序
    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.saveSessions(sessions);
  },

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    this.saveSessions(sessions);
  },

  // 获取某个动作最近一次的训练组数据（用于智能快速预填与参考）
  getLastExerciseLog(exerciseId: string): ExerciseLog | null {
    const sessions = this.getSessions();
    for (const session of sessions) {
      const match = session.exercises.find(e => e.exerciseId === exerciseId && e.sets.some(s => s.completed));
      if (match) return match;
    }
    return null;
  },

  // 进行中的会话暂存
  getActiveSession(): WorkoutSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  saveActiveSession(session: WorkoutSession | null): void {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  },

  // 体重与生活日志
  getWeightLogs(): WeightLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.WEIGHTS);
    let logs: WeightLog[] = [];
    if (!raw) {
      logs = [...INITIAL_WEIGHTS];
      const oldRaw = localStorage.getItem(STORAGE_KEYS.OLD_WEIGHTS);
      if (oldRaw) {
        try {
          const oldLogs: WeightLog[] = JSON.parse(oldRaw);
          for (const ol of oldLogs) {
            if (!logs.some(l => l.date === ol.date)) {
              logs.push(ol);
            }
          }
        } catch {
          // ignore
        }
      }
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(logs));
      return logs;
    }

    try {
      logs = JSON.parse(raw);
    } catch {
      logs = [...INITIAL_WEIGHTS];
    }

    // 补齐 10.07 (晚上吃了鸡公煲), 10.08, 10.09 体重记录
    const missingWeights = INITIAL_WEIGHTS.filter(
      initW => !logs.some(l => l.date === initW.date)
    );
    if (missingWeights.length > 0) {
      logs = [...logs, ...missingWeights];
      logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(logs));
    }

    return logs;
  },

  saveWeightLogs(logs: WeightLog[]): void {
    localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(logs));
  },

  addWeightLog(log: Omit<WeightLog, 'id'>): WeightLog {
    const logs = this.getWeightLogs();
    // 检查当天同时间段是否已存在，如存在则更新，否则新增
    const existingIndex = logs.findIndex(l => l.date === log.date && l.timeSlot === log.timeSlot);
    let targetLog: WeightLog;
    if (existingIndex >= 0) {
      targetLog = {
        ...logs[existingIndex],
        ...log,
      };
      logs[existingIndex] = targetLog;
    } else {
      targetLog = {
        ...log,
        id: `w-${Date.now()}`,
      };
      logs.unshift(targetLog);
    }
    // 按日期降序排序
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.saveWeightLogs(logs);
    return targetLog;
  },

  deleteWeightLog(id: string): void {
    const logs = this.getWeightLogs().filter(l => l.id !== id);
    this.saveWeightLogs(logs);
  },

  // 恢复内置官方数据（含 10.06-10.09 全部真实记录与预设重量）
  restoreOfficialData(): void {
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(INITIAL_EXERCISES));
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(INITIAL_PLANS));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_SESSIONS));
    localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(INITIAL_WEIGHTS));
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  },

  // 备份与恢复
  exportBackupJson(): string {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exercises: this.getExercises(),
      plans: this.getPlans(),
      sessions: this.getSessions(),
      weights: this.getWeightLogs(),
    };
    return JSON.stringify(data, null, 2);
  },

  importBackupJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.exercises)) this.saveExercises(data.exercises);
      if (Array.isArray(data.plans)) this.savePlans(data.plans);
      if (Array.isArray(data.sessions)) this.saveSessions(data.sessions);
      if (Array.isArray(data.weights)) this.saveWeightLogs(data.weights);
      return true;
    } catch (err) {
      console.error('Failed to import backup:', err);
      return false;
    }
  },

  resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.EXERCISES);
    localStorage.removeItem(STORAGE_KEYS.PLANS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.WEIGHTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }
};
