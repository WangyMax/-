import { WorkoutPlan } from '../types';

export const INITIAL_PLANS: WorkoutPlan[] = [
  {
    id: 'plan-chest-triceps',
    name: '胸 ➕ 三头',
    categoryTags: ['胸部', '肱三头'],
    description: '胸部多角度推与夹胸，搭配肱三头训练',
    cardioMinutes: 0,
    exercises: [
      { exerciseId: 'ex-chest-01', targetSets: 4, targetReps: 12, targetWeight: 35, targetUnit: 'kg', pulleyRatio: 'none', notes: '蝴蝶机夹胸（前）35kg' },
      { exerciseId: 'ex-chest-02', targetSets: 4, targetReps: 12, targetWeight: 60, targetUnit: 'kg', pulleyRatio: 'none', notes: '卧推 60kg' },
      { exerciseId: 'ex-chest-03', targetSets: 4, targetReps: 9, targetWeight: 35, targetUnit: 'kg', pulleyRatio: 'none', notes: '上斜固定推胸 35kg' },
      { exerciseId: 'ex-chest-04', targetSets: 4, targetReps: 10, targetWeight: 50, targetUnit: 'kg', pulleyRatio: 'none', notes: '固定推中胸 50kg' },
      { exerciseId: 'ex-chest-05', targetSets: 4, targetReps: 10, targetWeight: 10, targetUnit: 'plates', pulleyRatio: 'none', notes: '下胸器械 10片' },
      { exerciseId: 'ex-tri-01', targetSets: 3, targetReps: 12, targetWeight: 6, targetUnit: 'plates', pulleyRatio: 'none', notes: '绳索过头臂屈伸' },
      { exerciseId: 'ex-tri-02', targetSets: 3, targetReps: 12, targetWeight: 7, targetUnit: 'plates', pulleyRatio: 'none', notes: '绳索下压' },
    ]
  },
  {
    id: 'plan-back-biceps',
    name: '背 ➕ 二头',
    categoryTags: ['背部', '肱二头'],
    description: '垂直拉与水平划船结合，搭配肱二头训练',
    cardioMinutes: 0,
    exercises: [
      { exerciseId: 'ex-back-01', targetSets: 4, targetReps: 12, targetWeight: 30, targetUnit: 'assisted', pulleyRatio: 'none', notes: '引体向上 助力' },
      { exerciseId: 'ex-back-02', targetSets: 4, targetReps: 12, targetWeight: 15, targetUnit: 'plates', pulleyRatio: 'none', notes: '窄距划船 15片' },
      { exerciseId: 'ex-back-03', targetSets: 4, targetReps: 10, targetWeight: 40, targetUnit: 'kg', pulleyRatio: 'none', notes: '反手高位下拉 40kg' },
      { exerciseId: 'ex-back-04', targetSets: 4, targetReps: 8, targetWeight: 25, targetUnit: 'kg', pulleyRatio: 'none', notes: '单臂器械划船 25kg' },
      { exerciseId: 'ex-bi-01', targetSets: 3, targetReps: 12, targetWeight: 10, targetUnit: 'kg', pulleyRatio: 'none', notes: '哑铃交替弯举' },
      { exerciseId: 'ex-bi-03', targetSets: 3, targetReps: 12, targetWeight: 12, targetUnit: 'kg', pulleyRatio: 'none', notes: '锤式弯举' },
    ]
  },
  {
    id: 'plan-shoulder-abs',
    name: '肩 ➕ 腹部',
    categoryTags: ['肩部', '腹部核心'],
    description: '三角肌前中后束训练，搭配腹部核心',
    cardioMinutes: 0,
    exercises: [
      { exerciseId: 'ex-sho-02', targetSets: 4, targetReps: 12, targetWeight: 30, targetUnit: 'kg', pulleyRatio: 'none', notes: '反向飞鸟 双滑轮 30kg' },
      { exerciseId: 'ex-sho-01', targetSets: 4, targetReps: 8, targetWeight: 20, targetUnit: 'kg', pulleyRatio: 'none', notes: '推肩 20kg' },
      { 
        exerciseId: 'ex-sho-03', 
        targetSets: 4, 
        isDropSet: true,
        dropStages: [
          { id: 'stg-1', weightOrPlates: 10, unit: 'kg', reps: 12 },
          { id: 'stg-2', weightOrPlates: 7.5, unit: 'kg', reps: 12 },
          { id: 'stg-3', weightOrPlates: 5, unit: 'kg', reps: 10 },
          { id: 'stg-4', weightOrPlates: 2.5, unit: 'kg', reps: 12 },
        ],
        notes: '超级组飞鸟 (10kg->7.5kg->5kg->2.5kg 递减)' 
      },
      { exerciseId: 'ex-sho-04', targetSets: 4, targetReps: 12, targetWeight: 5, targetUnit: 'kg', pulleyRatio: 'none', notes: '前平举 5kg' },
      { exerciseId: 'ex-sho-05', targetSets: 4, targetReps: 12, targetWeight: 1, targetUnit: 'plates', pulleyRatio: 'none', notes: 'Y 举 一片' },
      { exerciseId: 'ex-abs-01', targetSets: 3, targetReps: 15, targetWeight: 8, targetUnit: 'plates', pulleyRatio: 'none', notes: '器械卷腹' },
    ]
  },
  {
    id: 'plan-leg-focus',
    name: '腿部专注 (深蹲日)',
    categoryTags: ['腿部', '专注下肢'],
    description: '下肢全能轰炸（股四/腘绳/内收），体力消耗极大，练后不安排有氧',
    cardioMinutes: 0,
    exercises: [
      { exerciseId: 'ex-leg-01', targetSets: 4, targetReps: 8, targetWeight: 90, targetUnit: 'kg', pulleyRatio: 'none', notes: '哈克深蹲 90kg' },
      { exerciseId: 'ex-leg-02', targetSets: 4, targetReps: 12, targetWeight: 90, targetUnit: 'kg', pulleyRatio: 'none', notes: '倒蹬 90kg' },
      { exerciseId: 'ex-leg-03', targetSets: 4, targetReps: 12, targetWeight: 45, targetUnit: 'kg', pulleyRatio: 'none', notes: '腿屈伸 45kg' },
      { exerciseId: 'ex-leg-04', targetSets: 4, targetReps: 12, targetWeight: 40, targetUnit: 'kg', pulleyRatio: 'none', notes: '内收肌 40kg' },
      { exerciseId: 'ex-leg-05', targetSets: 4, targetReps: 12, targetWeight: 35, targetUnit: 'kg', pulleyRatio: 'none', notes: '俯身腿弯举 35kg' },
    ]
  }
];
