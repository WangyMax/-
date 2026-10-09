import { WorkoutPlan } from '../types';

export const INITIAL_PLANS: WorkoutPlan[] = [
  {
    id: 'plan-chest-triceps',
    name: '胸 ➕ 三头',
    categoryTags: ['胸部', '肱三头', '有氧20m'],
    description: '胸部多角度推与夹胸，附带肱三头长头与外侧头孤立，练后20分钟有氧燃脂',
    cardioMinutes: 20,
    cardioType: '跑步机坡度快走',
    exercises: [
      { exerciseId: 'ex-chest-01', targetSets: 4, targetReps: 12, notes: '热身激活/胸肌充血' },
      { exerciseId: 'ex-chest-02', targetSets: 4, targetReps: 10, notes: '主力量推胸' },
      { exerciseId: 'ex-chest-03', targetSets: 4, targetReps: 12, notes: '上斜器械，锁骨束' },
      { exerciseId: 'ex-chest-04', targetSets: 4, targetReps: 12, notes: '中胸挤压' },
      { exerciseId: 'ex-chest-05', targetSets: 4, targetReps: 12, notes: '下胸轮廓' },
      { exerciseId: 'ex-tri-01', targetSets: 4, targetReps: 12, notes: '过头臂屈伸，拉伸长头' },
      { exerciseId: 'ex-tri-02', targetSets: 4, targetReps: 12, notes: '绳索下压，外侧头泵感' },
    ]
  },
  {
    id: 'plan-back-biceps',
    name: '背 ➕ 二头',
    categoryTags: ['背部', '肱二头', '有氧20m'],
    description: '垂直拉与水平划船结合，搭配肱二头长头与肱肌刺激，练后20分钟有氧',
    cardioMinutes: 20,
    cardioType: '跑步机坡度快走',
    exercises: [
      { exerciseId: 'ex-back-01', targetSets: 4, targetReps: 10, notes: '助力引体，充分拉伸背阔' },
      { exerciseId: 'ex-back-02', targetSets: 4, targetReps: 12, notes: '窄距坐姿划船，背部厚度' },
      { exerciseId: 'ex-back-03', targetSets: 4, targetReps: 12, notes: '反手下拉，下背阔专注' },
      { exerciseId: 'ex-back-04', targetSets: 4, targetReps: 12, notes: '单臂划船，单侧顶峰收缩' },
      { exerciseId: 'ex-bi-01', targetSets: 4, targetReps: 12, notes: '哑铃交替弯举' },
      { exerciseId: 'ex-bi-02', targetSets: 3, targetReps: 12, notes: '上斜弯举，深度拉伸长头' },
      { exerciseId: 'ex-bi-03', targetSets: 3, targetReps: 12, notes: '锤式弯举，手臂厚度' },
    ]
  },
  {
    id: 'plan-shoulder-abs',
    name: '肩 ➕ 腹部',
    categoryTags: ['肩部', '腹部核心', '有氧20m'],
    description: '三角肌前中后束立体雕刻，加上腹下腹核心刺激，练后20分钟有氧',
    cardioMinutes: 20,
    cardioType: '跑步机坡度快走',
    exercises: [
      { exerciseId: 'ex-sho-01', targetSets: 4, targetReps: 10, notes: '座姿推肩，主复合力量' },
      { exerciseId: 'ex-sho-02', targetSets: 4, targetReps: 15, notes: '哑铃侧平举，打造肩宽' },
      { exerciseId: 'ex-sho-04', targetSets: 4, targetReps: 15, notes: '反向飞鸟，三角肌后束' },
      { exerciseId: 'ex-sho-05', targetSets: 3, targetReps: 15, notes: '绳索面拉，肩袖与后束' },
      { exerciseId: 'ex-abs-01', targetSets: 4, targetReps: 15, notes: '器械负重卷腹' },
      { exerciseId: 'ex-abs-03', targetSets: 4, targetReps: 15, notes: '罗马椅/悬垂举腿，攻下腹' },
    ]
  },
  {
    id: 'plan-leg-focus',
    name: '腿部专注 (深蹲日)',
    categoryTags: ['腿部', '专注下肢', '无有氧'],
    description: '下肢全能轰炸（股四/腘绳/内收），体力消耗极大，练后不安排有氧',
    cardioMinutes: 0,
    cardioType: '无',
    exercises: [
      { exerciseId: 'ex-leg-01', targetSets: 4, targetReps: 10, notes: '哈克深蹲，股四主力' },
      { exerciseId: 'ex-leg-02', targetSets: 4, targetReps: 12, notes: '倒蹬腿举，深层负荷' },
      { exerciseId: 'ex-leg-03', targetSets: 4, targetReps: 12, notes: '坐姿腿屈伸，雕刻股四线条' },
      { exerciseId: 'ex-leg-04', targetSets: 4, targetReps: 15, notes: '内收肌夹腿，骨盆与内侧加固' },
      { exerciseId: 'ex-leg-05', targetSets: 4, targetReps: 12, notes: '俯身腿弯举，大腿后侧腘绳' },
    ]
  }
];
