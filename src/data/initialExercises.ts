import { Exercise } from '../types';

export const INITIAL_EXERCISES: Exercise[] = [
  // ===================== 胸部 (Chest) =====================
  {
    id: 'ex-chest-01',
    name: '蝴蝶机夹胸（前）',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '通常作为热身激活或收尾力竭动作'
  },
  {
    id: 'ex-chest-02',
    name: '卧推 (平板推胸)',
    category: 'chest',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '杠铃/器械平板推胸，核心力量动作'
  },
  {
    id: 'ex-chest-03',
    name: '上斜固定推胸',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '上胸针对性器械，专注锁骨束发力'
  },
  {
    id: 'ex-chest-04',
    name: '固定推中胸',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '座姿固定推胸机'
  },
  {
    id: 'ex-chest-05',
    name: '下胸器械推胸',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '下斜推胸机或双杠下推'
  },
  {
    id: 'ex-chest-06',
    name: '哑铃上斜卧推',
    category: 'chest',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    notes: '每侧单只哑铃重量'
  },
  {
    id: 'ex-chest-07',
    name: '龙门架绳索高位夹胸',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    notes: '龙门架滑轮，常见2:1双滑轮或1:1'
  },
  {
    id: 'ex-chest-08',
    name: '龙门架绳索低位夹胸',
    category: 'chest',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
  },

  // ===================== 背部 (Back) =====================
  {
    id: 'ex-back-01',
    name: '助力引体向上',
    category: 'back',
    defaultUnit: 'assisted',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '插销配重片为抵消体重的助力重量'
  },
  {
    id: 'ex-back-02',
    name: '窄距划船 (器械/绳索)',
    category: 'back',
    defaultUnit: 'plates',
    defaultPulley: '1:1',
    isFavorite: true,
    notes: '坐姿划船机，关注背阔肌与背部厚度'
  },
  {
    id: 'ex-back-03',
    name: '反手高位下拉',
    category: 'back',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '反手握距，强刺激背阔肌下部'
  },
  {
    id: 'ex-back-04',
    name: '单臂器械划船',
    category: 'back',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '单侧孤立发力，改善左右对称性'
  },
  {
    id: 'ex-back-05',
    name: '正手宽距高位下拉',
    category: 'back',
    defaultUnit: 'plates',
    defaultPulley: 'none',
  },
  {
    id: 'ex-back-06',
    name: '直臂绳索下压',
    category: 'back',
    defaultUnit: 'plates',
    defaultPulley: '1:1',
    notes: '孤立激活背阔肌'
  },
  {
    id: 'ex-back-07',
    name: '杠铃俯身划船',
    category: 'back',
    defaultUnit: 'kg',
    defaultPulley: 'none',
  },

  // ===================== 腿部 (Legs) =====================
  {
    id: 'ex-leg-01',
    name: '哈克深蹲',
    category: 'leg',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '斜角固定轨迹，极致刺激股四头肌'
  },
  {
    id: 'ex-leg-02',
    name: '倒蹬 (器械腿举)',
    category: 'leg',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '45度倒蹬机挂片重量'
  },
  {
    id: 'ex-leg-03',
    name: '腿屈伸 (坐姿腿屈伸)',
    category: 'leg',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '股四头肌单关节孤立刺激'
  },
  {
    id: 'ex-leg-04',
    name: '内收肌夹腿 (大腿内收机)',
    category: 'leg',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '强化大腿内侧肌群与髋关节稳定'
  },
  {
    id: 'ex-leg-05',
    name: '俯身腿弯举 (俯卧腿弯举)',
    category: 'leg',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '大腿后侧腘绳肌孤立动作'
  },
  {
    id: 'ex-leg-06',
    name: '罗马尼亚硬拉 (RDL)',
    category: 'leg',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    notes: '臀大肌与腘绳肌离心拉伸'
  },
  {
    id: 'ex-leg-07',
    name: '哑铃箭步蹲',
    category: 'leg',
    defaultUnit: 'kg',
    defaultPulley: 'none',
  },
  {
    id: 'ex-leg-08',
    name: '坐姿/站姿提踵',
    category: 'leg',
    defaultUnit: 'plates',
    defaultPulley: 'none',
  },

  // ===================== 肱三头 (Triceps) =====================
  {
    id: 'ex-tri-01',
    name: '绳索过头臂屈伸',
    category: 'triceps',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    isFavorite: true,
    notes: '龙门架下位/中位绳索，强化三头肌长头'
  },
  {
    id: 'ex-tri-02',
    name: '绳索下压 (直杆/V柄/麻绳)',
    category: 'triceps',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    isFavorite: true,
    notes: '高位绳索下压，强化外侧头与内侧头'
  },
  {
    id: 'ex-tri-03',
    name: '双杠臂屈伸 (三头针对)',
    category: 'triceps',
    defaultUnit: 'bodyweight',
    defaultPulley: 'none',
    notes: '身体保持直立以针对三头肌'
  },
  {
    id: 'ex-tri-04',
    name: '仰卧杠铃臂屈伸 (法式推举)',
    category: 'triceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
  },
  {
    id: 'ex-tri-05',
    name: '哑铃俯身后臂屈伸',
    category: 'triceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
  },

  // ===================== 肱二头 (Biceps) =====================
  {
    id: 'ex-bi-01',
    name: '哑铃交替弯举',
    category: 'biceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '经典二头动作，顶峰旋转收缩'
  },
  {
    id: 'ex-bi-02',
    name: '上斜哑铃弯举',
    category: 'biceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '斜凳大幅拉伸肱二头肌长头'
  },
  {
    id: 'ex-bi-03',
    name: '绳索/哑铃锤式弯举',
    category: 'biceps',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    isFavorite: true,
    notes: '强化肱肌与肱桡肌，增加手臂厚度'
  },
  {
    id: 'ex-bi-04',
    name: 'EZ杠/直杠站姿弯举',
    category: 'biceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
  },
  {
    id: 'ex-bi-05',
    name: '牧师凳托臂弯举',
    category: 'biceps',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    notes: '彻底孤立二头短头肌峰'
  },

  // ===================== 肩部 (Shoulder) =====================
  {
    id: 'ex-sho-01',
    name: '坐姿器械/哑铃推肩',
    category: 'shoulder',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '肩部主复合力量动作'
  },
  {
    id: 'ex-sho-02',
    name: '哑铃侧平举',
    category: 'shoulder',
    defaultUnit: 'kg',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '打造肩部中束宽度，轻重量多组数'
  },
  {
    id: 'ex-sho-03',
    name: '绳索单臂侧平举',
    category: 'shoulder',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    notes: '全程恒定张力'
  },
  {
    id: 'ex-sho-04',
    name: '蝴蝶机反向飞鸟 (反向夹胸)',
    category: 'shoulder',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '针对三角肌后束孤立刺激'
  },
  {
    id: 'ex-sho-05',
    name: '绳索面拉 (Face Pull)',
    category: 'shoulder',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    notes: '后束与肩袖外旋健康动作'
  },

  // ===================== 腹部与核心 (Abs) =====================
  {
    id: 'ex-abs-01',
    name: '器械卷腹',
    category: 'abs',
    defaultUnit: 'plates',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '固定轨迹负重卷腹'
  },
  {
    id: 'ex-abs-02',
    name: '绳索跪姿卷腹',
    category: 'abs',
    defaultUnit: 'plates',
    defaultPulley: '2:1',
    isFavorite: true,
    notes: '龙门架绳索下压卷腹'
  },
  {
    id: 'ex-abs-03',
    name: '罗马椅/悬垂举腿',
    category: 'abs',
    defaultUnit: 'bodyweight',
    defaultPulley: 'none',
    isFavorite: true,
    notes: '下腹部针对性刺激'
  },
  {
    id: 'ex-abs-04',
    name: '平板支撑',
    category: 'abs',
    defaultUnit: 'bodyweight',
    defaultPulley: 'none',
  },
  {
    id: 'ex-abs-05',
    name: '健腹轮',
    category: 'abs',
    defaultUnit: 'bodyweight',
    defaultPulley: 'none',
  },

  // ===================== 有氧 (Cardio) =====================
  {
    id: 'ex-car-01',
    name: '跑步机坡度快走',
    category: 'cardio',
    defaultUnit: 'bodyweight',
    isFavorite: true,
    notes: '推荐坡度 8~12，速度 4.5~5.5km/h，练后燃脂 20 分钟'
  },
  {
    id: 'ex-car-02',
    name: '爬楼机 (楼梯机)',
    category: 'cardio',
    defaultUnit: 'bodyweight',
    notes: '高效燃脂与下肢心肺耐力'
  },
  {
    id: 'ex-car-03',
    name: '椭圆机',
    category: 'cardio',
    defaultUnit: 'bodyweight',
    notes: '低冲击护膝关节有氧'
  },
  {
    id: 'ex-car-04',
    name: '动感单车',
    category: 'cardio',
    defaultUnit: 'bodyweight',
  }
];
