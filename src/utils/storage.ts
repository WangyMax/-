import { Exercise, WorkoutPlan, WorkoutSession, WeightLog, ExerciseLog } from '../types';
import { INITIAL_EXERCISES } from '../data/initialExercises';
import { INITIAL_PLANS } from '../data/initialPlans';

const STORAGE_KEYS = {
  EXERCISES: 'fitcustom_exercises_v1',
  PLANS: 'fitcustom_plans_v1',
  SESSIONS: 'fitcustom_sessions_v1',
  WEIGHTS: 'fitcustom_weights_v1',
  ACTIVE_SESSION: 'fitcustom_active_session_v1',
  REST_TIMER: 'fitcustom_rest_timer_v1',
};

// 预填充部分真实的最近历史数据（让用户开箱即见上周历史与体重备注）
const INITIAL_WEIGHTS: WeightLog[] = [
  {
    id: 'w-01',
    date: '2026-10-06',
    weight: 63.5,
    timeSlot: 'morning',
    note: '晨起空腹，体能良好'
  },
  {
    id: 'w-02',
    date: '2026-10-07',
    weight: 63.8,
    timeSlot: 'evening',
    note: '练后称重，晚上吃了鸡公煲，蛋白质摄入充足'
  },
  {
    id: 'w-03',
    date: '2026-10-09',
    weight: 63.2,
    timeSlot: 'morning',
    note: '腿日晨起称重，准备冲哈克深蹲'
  }
];

const INITIAL_SESSIONS: WorkoutSession[] = [
  {
    id: 'sess-init-01',
    date: '2026-10-06',
    planId: 'plan-chest-triceps',
    planName: '胸 ➕ 三头',
    startTime: new Date('2026-10-06 18:30:00').getTime(),
    endTime: new Date('2026-10-06 19:40:00').getTime(),
    cardioMinutes: 20,
    cardioCompleted: true,
    cardioType: '跑步机坡度快走',
    cardioNotes: '坡度 10，速度 5.0，出汗畅快',
    notes: '状态不错，蝴蝶机夹胸充分激活，三头泵感强烈',
    exercises: [
      {
        exerciseId: 'ex-chest-01',
        exerciseName: '蝴蝶机夹胸（前）',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'plates',
        sets: [
          { id: 's1', setNumber: 1, unit: 'plates', weightOrPlates: 6, reps: 15, completed: true },
          { id: 's2', setNumber: 2, unit: 'plates', weightOrPlates: 8, reps: 12, completed: true },
          { id: 's3', setNumber: 3, unit: 'plates', weightOrPlates: 9, reps: 12, completed: true },
          { id: 's4', setNumber: 4, unit: 'plates', weightOrPlates: 9, reps: 10, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-02',
        exerciseName: '卧推 (平板推胸)',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'kg',
        sets: [
          { id: 's1', setNumber: 1, unit: 'kg', weightOrPlates: 40, reps: 12, completed: true },
          { id: 's2', setNumber: 2, unit: 'kg', weightOrPlates: 50, reps: 10, completed: true },
          { id: 's3', setNumber: 3, unit: 'kg', weightOrPlates: 50, reps: 8, completed: true },
          { id: 's4', setNumber: 4, unit: 'kg', weightOrPlates: 45, reps: 10, completed: true },
        ]
      },
      {
        exerciseId: 'ex-chest-03',
        exerciseName: '上斜固定推胸',
        category: 'chest',
        pulleyRatio: 'none',
        currentUnit: 'plates',
        sets: [
          { id: 's1', setNumber: 1, unit: 'plates', weightOrPlates: 7, reps: 12, completed: true },
          { id: 's2', setNumber: 2, unit: 'plates', weightOrPlates: 8, reps: 12, completed: true },
          { id: 's3', setNumber: 3, unit: 'plates', weightOrPlates: 9, reps: 10, completed: true },
          { id: 's4', setNumber: 4, unit: 'plates', weightOrPlates: 9, reps: 9, completed: true },
        ]
      },
      {
        exerciseId: 'ex-tri-01',
        exerciseName: '绳索过头臂屈伸',
        category: 'triceps',
        pulleyRatio: '2:1',
        currentUnit: 'plates',
        sets: [
          { id: 's1', setNumber: 1, unit: 'plates', weightOrPlates: 5, reps: 15, completed: true, pulleyRatio: '2:1' },
          { id: 's2', setNumber: 2, unit: 'plates', weightOrPlates: 6, reps: 12, completed: true, pulleyRatio: '2:1' },
          { id: 's3', setNumber: 3, unit: 'plates', weightOrPlates: 7, reps: 10, completed: true, pulleyRatio: '2:1' },
        ]
      }
    ]
  },
  {
    id: 'sess-init-02',
    date: '2026-10-07',
    planId: 'plan-back-biceps',
    planName: '背 ➕ 二头',
    startTime: new Date('2026-10-07 19:00:00').getTime(),
    endTime: new Date('2026-10-07 20:15:00').getTime(),
    cardioMinutes: 20,
    cardioCompleted: true,
    cardioType: '跑步机坡度快走',
    cardioNotes: '附加20分钟快走',
    notes: '引体向上助力调小了一格，背阔肌收缩感明显',
    exercises: [
      {
        exerciseId: 'ex-back-01',
        exerciseName: '助力引体向上',
        category: 'back',
        pulleyRatio: 'none',
        currentUnit: 'assisted',
        sets: [
          { id: 's1', setNumber: 1, unit: 'assisted', weightOrPlates: 30, reps: 12, completed: true },
          { id: 's2', setNumber: 2, unit: 'assisted', weightOrPlates: 25, reps: 10, completed: true },
          { id: 's3', setNumber: 3, unit: 'assisted', weightOrPlates: 25, reps: 8, completed: true },
          { id: 's4', setNumber: 4, unit: 'assisted', weightOrPlates: 30, reps: 8, completed: true },
        ]
      },
      {
        exerciseId: 'ex-back-02',
        exerciseName: '窄距划船 (器械/绳索)',
        category: 'back',
        pulleyRatio: '1:1',
        currentUnit: 'plates',
        sets: [
          { id: 's1', setNumber: 1, unit: 'plates', weightOrPlates: 8, reps: 12, completed: true, pulleyRatio: '1:1' },
          { id: 's2', setNumber: 2, unit: 'plates', weightOrPlates: 10, reps: 12, completed: true, pulleyRatio: '1:1' },
          { id: 's3', setNumber: 3, unit: 'plates', weightOrPlates: 11, reps: 10, completed: true, pulleyRatio: '1:1' },
          { id: 's4', setNumber: 4, unit: 'plates', weightOrPlates: 11, reps: 10, completed: true, pulleyRatio: '1:1' },
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
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(INITIAL_EXERCISES));
      return INITIAL_EXERCISES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EXERCISES;
    }
  },

  saveExercises(list: Exercise[]): void {
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(list));
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
      localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(INITIAL_PLANS));
      return INITIAL_PLANS;
    }
    try {
      return JSON.parse(raw);
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
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_SESSIONS));
      return INITIAL_SESSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SESSIONS;
    }
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
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(INITIAL_WEIGHTS));
      return INITIAL_WEIGHTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_WEIGHTS;
    }
  },

  saveWeightLogs(logs: WeightLog[]): void {
    localStorage.setItem(STORAGE_KEYS.WEIGHTS, JSON.stringify(logs));
  },

  addWeightLog(log: Omit<WeightLog, 'id'>): WeightLog {
    const logs = this.getWeightLogs();
    const newLog: WeightLog = {
      ...log,
      id: `w-${Date.now()}`,
    };
    logs.unshift(newLog);
    // 按日期降序排序
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.saveWeightLogs(logs);
    return newLog;
  },

  deleteWeightLog(id: string): void {
    const logs = this.getWeightLogs().filter(l => l.id !== id);
    this.saveWeightLogs(logs);
  },

  // 备份与恢复
  exportBackupJson(): string {
    const data = {
      version: '1.0',
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
