import { useCallback, useState, useEffect } from 'react';
import {
  Plus, Edit3, Trash2, Copy, Play,
  Flame, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  WorkoutPlan, Exercise, PlanExerciseTarget, CATEGORY_LABELS, UNIT_LABELS,
  ResistanceUnit, PulleyRatio
} from '../types';
import { StorageService } from '../utils/storage';
import { ConfirmSheet } from './ConfirmSheet';
import { Badge, Button, Card, IconButton, SegmentedControl, Sheet, cx } from '../ui';

interface PlansViewProps {
  allExercises: Exercise[];
  onStartPlan: (plan: WorkoutPlan) => void;
  onRefreshExercises?: () => void;
}

const fieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';
const compactFieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-3 text-sm2 text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';
const compactSelectCls = 'h-11 rounded-ctl border border-line bg-surface-subtle px-2 text-sm2 text-ink focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';
const compactNumCls = 'h-11 rounded-[8px] border border-line bg-surface px-1 text-center text-sm2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none';
// 计划内每个动作的数字预设框：与 fieldCls 同源，但用等宽数字并居中
const numFieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-2 text-center text-body font-semibold tabular-nums text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';

type CardioOptionValue = '0' | '15' | '20' | '30' | 'custom';

const CARDIO_OPTIONS: ReadonlyArray<{ value: CardioOptionValue; label: string }> = [
  { value: '0', label: '无有氧' },
  { value: '15', label: '15分' },
  { value: '20', label: '20分' },
  { value: '30', label: '30分' },
];

// 计划名沿用了数据里的彩色 emoji，展示时统一成单色加号（不改数据）
const displayPlanName = (name: string) => name.replace(/➕/g, '+');

export const PlansView: React.FC<PlansViewProps> = ({
  allExercises,
  onStartPlan,
}) => {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectExOpen, setIsSelectExOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });
  // 从过往训练导入模板：挑选历史记录
  const [isImportSessionOpen, setIsImportSessionOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');

  // 加载计划列表
  const loadPlans = () => {
    const list = StorageService.getPlans();
    setPlans(list);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // 稳定引用：避免 Sheet 内部 focus effect 因 onClose 变化而反复抢焦点
  const closeEditSheet = useCallback(() => setIsModalOpen(false), []);
  const closeSelectExSheet = useCallback(() => setIsSelectExOpen(false), []);
  const closeImportSheet = useCallback(() => setIsImportSessionOpen(false), []);

  // 新建空计划
  const handleCreateNew = () => {
    const newPlan: WorkoutPlan = {
      id: `plan-${Date.now()}`,
      name: '自定义分化计划',
      categoryTags: ['自定义'],
      description: '',
      cardioMinutes: 20,
      cardioType: '跑步机坡度快走',
      exercises: []
    };
    setEditingPlan(newPlan);
    setIsModalOpen(true);
  };

  // 编辑现有计划
  const handleEditPlan = (plan: WorkoutPlan) => {
    setEditingPlan(JSON.parse(JSON.stringify(plan)));
    setIsModalOpen(true);
  };

  // 复制计划副本
  const handleDuplicate = (plan: WorkoutPlan) => {
    const copy: WorkoutPlan = {
      ...JSON.parse(JSON.stringify(plan)),
      id: `plan-${Date.now()}`,
      name: `${plan.name} (副本)`,
    };
    StorageService.savePlan(copy);
    loadPlans();
  };

  // 删除计划（自建抽屉确认）
  const handleDeletePlan = (planId: string, name: string) => {
    setConfirmState({
      open: true,
      title: '删除训练计划',
      description: `确定删除训练计划 “${displayPlanName(name)}” 吗？此操作无法撤销。`,
      onConfirm: () => {
        StorageService.deletePlan(planId);
        loadPlans();
        setConfirmState(prev => ({ ...prev, open: false }));
      },
    });
  };

  // 保存计划
  const handleSavePlan = () => {
    if (!editingPlan) return;
    if (!editingPlan.name.trim()) {
      setFormError('请输入计划名称');
      return;
    }
    setFormError(null);
    // 保存前清洗数字：清空未填的组数回退到标准 4 组，无效预设置空
    const sanitized: WorkoutPlan = {
      ...editingPlan,
      exercises: editingPlan.exercises.map(pe => ({
        ...pe,
        targetSets: pe.targetSets >= 1 ? Math.floor(pe.targetSets) : 4,
        targetReps: typeof pe.targetReps === 'number' && pe.targetReps >= 1 ? Math.floor(pe.targetReps) : undefined,
        targetWeight: typeof pe.targetWeight === 'number' && pe.targetWeight >= 0 ? pe.targetWeight : undefined,
        dropStages: pe.dropStages?.map(stg => ({
          ...stg,
          weightOrPlates: typeof stg.weightOrPlates === 'number' && stg.weightOrPlates >= 0 ? stg.weightOrPlates : 0,
          reps: typeof stg.reps === 'number' && stg.reps >= 0 ? Math.floor(stg.reps) : 0,
        })),
      })),
    };
    StorageService.savePlan(sanitized);
    setIsModalOpen(false);
    setEditingPlan(null);
    loadPlans();
  };

  // 添加动作到当前编辑计划
  const handleAddExerciseToPlan = (exercise: Exercise) => {
    if (!editingPlan) return;
    const newTarget: PlanExerciseTarget = {
      exerciseId: exercise.id,
      targetSets: 4,
      targetReps: 12,
      targetWeight: exercise.defaultUnit === 'plates' ? 10 : 30,
      targetUnit: exercise.defaultUnit,
      pulleyRatio: exercise.defaultPulley || 'none',
      // 左右独立动作默认带入单侧标记，开练时左右分别记录
      isUnilateral: exercise.isUnilateral || undefined,
      notes: exercise.notes || ''
    };
    setEditingPlan({
      ...editingPlan,
      exercises: [...editingPlan.exercises, newTarget]
    });
    setIsSelectExOpen(false);
  };

  // 计划卡内直接调整动作顺序：与编辑面板同一套交换算法，保存后立即刷新列表
  // 用 savePlans 传入新数组，避免 savePlan 就地改写 StorageService 缓存（该缓存同时是 React 状态引用）
  const movePlanExercise = (plan: WorkoutPlan, index: number, direction: 'up' | 'down') => {
    const newExercises = [...plan.exercises];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newExercises.length) return;
    const temp = newExercises[index];
    newExercises[index] = newExercises[targetIndex];
    newExercises[targetIndex] = temp;
    StorageService.savePlans(
      StorageService.getPlans().map(p => (p.id === plan.id ? { ...p, exercises: newExercises } : p)),
    );
    loadPlans();
  };

  // 调整动作排序（编辑面板内，只改编辑中的草稿）
  const moveExercise = (index: number, direction: 'up' | 'down') => {
    if (!editingPlan) return;
    const newExercises = [...editingPlan.exercises];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newExercises.length) return;
    const temp = newExercises[index];
    newExercises[index] = newExercises[targetIndex];
    newExercises[targetIndex] = temp;
    setEditingPlan({ ...editingPlan, exercises: newExercises });
  };

  // 移除动作
  const removeExerciseFromPlan = (index: number) => {
    if (!editingPlan) return;
    const newExercises = [...editingPlan.exercises];
    newExercises.splice(index, 1);
    setEditingPlan({ ...editingPlan, exercises: newExercises });
  };

  // 从过往训练导入为模板：取该场已完成组的典型值做计划预设
  const handleImportSession = (sessId: string) => {
    if (!editingPlan) return;
    const sess = StorageService.getSessions().find(s => s.id === sessId);
    if (!sess || sess.isRestDay) return;
    const targets: PlanExerciseTarget[] = sess.exercises.map(e => {
      const done = e.sets.filter(s => s.completed);
      const ref = done[done.length - 1] || e.sets[e.sets.length - 1];
      const uni = Boolean(e.isUnilateral || ref?.unilateral);
      const w = uni ? (ref?.left?.weight ?? ref?.weightOrPlates ?? 0) : (ref?.weightOrPlates ?? 0);
      const r = uni ? (ref?.left?.reps ?? ref?.reps ?? 12) : (ref?.reps ?? 12);
      const target: PlanExerciseTarget = {
        exerciseId: e.exerciseId,
        targetSets: Math.max(1, e.sets.length),
        targetReps: r,
        targetWeight: w,
        targetUnit: ref?.unit || e.currentUnit,
        pulleyRatio: ref?.pulleyRatio || e.pulleyRatio,
        isUnilateral: uni || undefined,
        notes: e.notes || '',
      };
      if (ref?.isDropSet && ref.dropStages && ref.dropStages.length > 0) {
        target.isDropSet = true;
        target.isUnilateral = undefined;
        target.dropStages = JSON.parse(JSON.stringify(ref.dropStages));
      }
      return target;
    });
    setEditingPlan({
      ...editingPlan,
      name: editingPlan.name === '自定义分化计划' ? `${sess.planName}（模板）` : editingPlan.name,
      cardioMinutes: sess.cardioMinutes,
      cardioType: sess.cardioType,
      exercises: targets,
    });
    setIsImportSessionOpen(false);
  };

  // 编辑 Sheet 标题：已存在的计划显示“编辑计划”，新建的显示“新建计划”
  const isEditingExistingPlan = Boolean(editingPlan && plans.some(p => p.id === editingPlan.id));
  // 历史导入可能带来 25 分钟这类非预设值：分段控件不选中任何一档，另起一行说明当前值
  const cardioValue: CardioOptionValue = editingPlan
    ? (CARDIO_OPTIONS.some(o => o.value === String(editingPlan.cardioMinutes))
      ? (String(editingPlan.cardioMinutes) as CardioOptionValue)
      : 'custom')
    : '0';
  const cardioOptions: ReadonlyArray<{ value: CardioOptionValue; label: string }> =
    cardioValue === 'custom' && editingPlan
      ? [...CARDIO_OPTIONS, { value: 'custom', label: `${editingPlan.cardioMinutes}分` }]
      : CARDIO_OPTIONS;

  const importSessions = isImportSessionOpen
    ? StorageService.getSessions().filter(s => {
      const kw = importSearch.toLowerCase();
      return !s.isRestDay
        && (!kw || s.planName.toLowerCase().includes(kw) || s.date.includes(kw));
    })
    : [];

  const filteredExercises = allExercises
    .filter(e => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()));

  return (
    <div className="pb-24 pt-2">
      {/* 头部标题与新建按钮 */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-cap font-semibold text-ink-3">
          <span className="tracking-[0.08em]">FITCUSTOM PRO</span>
          <span>计划库</span>
        </div>
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h1 font-bold text-ink">自定义训练计划</h1>
            <p className="mt-1 text-sm2 text-ink-2">自主编排分化循环，灵活设定目标重量与组数</p>
          </div>
          <Button variant="primary" size="lg" onClick={handleCreateNew} className="mt-1 shrink-0">
            <Plus className="h-4 w-4" /> 新建计划
          </Button>
        </div>
      </div>

      {/* 计划卡片列表 */}
      <div className="space-y-3">
        {plans.length === 0 && (
          <Card className="px-4 py-8 text-center">
            <p className="text-body text-ink-2">还没有训练计划，创建一个开始编排分化循环</p>
            <Button variant="outline" size="lg" className="mt-3" onClick={handleCreateNew}>
              <Plus className="h-4 w-4" /> 新建计划
            </Button>
          </Card>
        )}
        {plans.map((plan) => (
          <Card key={plan.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-h2 font-semibold text-ink">{displayPlanName(plan.name)}</h3>
                  {plan.categoryTags.map((tag, i) => (
                    <Badge key={`${plan.id}-tag-${i}`}>{tag}</Badge>
                  ))}
                </div>
                {plan.description && (
                  <p className="mt-1 text-sm2 text-ink-2">{plan.description}</p>
                )}
              </div>

              {/* 快捷开练入口：全屏唯一的实心主按钮留给“新建计划”，这里用描边按钮保证可辨识 */}
              <Button
                variant="outline"
                onClick={() => onStartPlan(plan)}
                className="shrink-0"
              >
                <Play className="h-4 w-4 fill-current" /> 一键开练
              </Button>
            </div>

            {/* 动作清单：1px 分隔列表 */}
            <div className="mt-3 border-t border-line pt-1">
              <span className="block pt-2 text-cap font-semibold text-ink-3">
                动作编排与预设负荷 · {plan.exercises.length} 个
              </span>
              <div>
                {plan.exercises.map((pe, idx) => {
                  const ex = allExercises.find(e => e.id === pe.exerciseId);
                  const unitStr = pe.targetUnit === 'plates' ? '片' : pe.targetUnit === 'assisted' ? 'kg助力' : pe.targetUnit === 'bodyweight' ? '自重' : 'kg';
                  const pulleyStr = pe.pulleyRatio && pe.pulleyRatio !== 'none' ? ` (${pe.pulleyRatio})` : '';
                  const isDrop = Boolean(pe.isDropSet || (pe.dropStages && pe.dropStages.length > 0));
                  return (
                    <div
                      key={`${plan.id}-ex-${idx}`}
                      className="flex min-h-14 items-center justify-between gap-2 border-t border-line py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-cap tabular-nums text-ink-3">{idx + 1}.</span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-body font-medium text-ink">{ex?.name || '未知动作'}</span>
                            {isDrop ? (
                              <Badge>
                                <Flame className="h-3 w-3" />超级组
                              </Badge>
                            ) : (
                              pe.isUnilateral && <Badge>左右独立</Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-cap text-ink-3">
                            {isDrop
                              ? `${pe.targetSets} 大组 · ${(pe.dropStages || []).map(s => `${s.weightOrPlates}×${s.reps}`).join(' → ')}`
                              : `${pe.targetSets}组 × ${pe.targetReps || 12}次${pe.targetWeight !== undefined ? ` · ${pe.targetWeight}${unitStr}${pulleyStr}` : ''}`}
                          </span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <IconButton
                          label={`上移「${ex?.name || '未知动作'}」`}
                          onClick={() => movePlanExercise(plan, idx, 'up')}
                          disabled={idx === 0}
                          className="h-11 w-10 disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`下移「${ex?.name || '未知动作'}」`}
                          onClick={() => movePlanExercise(plan, idx, 'down')}
                          disabled={idx === plan.exercises.length - 1}
                          className="h-11 w-10 disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 卡片底栏操作 */}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-1">
              <span className="min-w-0 truncate text-cap text-ink-3">
                有氧: {plan.cardioMinutes > 0 ? `${plan.cardioType || '有氧'} ${plan.cardioMinutes}分钟` : '练后无有氧'}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="复制计划为新副本" onClick={() => handleDuplicate(plan)}>
                  <Copy className="h-[18px] w-[18px]" />
                </IconButton>
                <Button variant="ghost" onClick={() => handleEditPlan(plan)}>
                  <Edit3 className="h-4 w-4" /> 编辑
                </Button>
                <IconButton label="删除计划" tone="danger" onClick={() => handleDeletePlan(plan.id, plan.name)}>
                  <Trash2 className="h-[18px] w-[18px]" />
                </IconButton>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 新建/编辑计划 Sheet（同一时刻只显示一层 Sheet：打开挑选动作或导入模板时暂时隐藏本层） */}
      <Sheet
        open={isModalOpen && Boolean(editingPlan) && !isSelectExOpen && !isImportSessionOpen}
        onClose={closeEditSheet}
        title={isEditingExistingPlan ? '编辑计划' : '新建计划'}
        description="设置组数与重量后，一键开练将直接带入"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeEditSheet}>取消</Button>
            <Button variant="primary" onClick={handleSavePlan}>保存计划</Button>
          </div>
        }
      >
        {editingPlan && (
          <div className="space-y-4">
            {formError && (
              <p className="rounded-ctl bg-danger-soft px-3 py-2 text-cap font-semibold text-danger">
                {formError}
              </p>
            )}

            <label className="block">
              <span className="mb-1 block text-cap font-semibold text-ink-2">计划名称（如: 胸 + 三头）</span>
              <input
                type="text"
                value={editingPlan.name}
                onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                placeholder="例如: 胸 + 三头、背 + 二头、腿日..."
                className={fieldCls}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-cap font-semibold text-ink-2">计划简介 / 备注</span>
              <input
                type="text"
                value={editingPlan.description}
                onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                placeholder="例如: 胸部推力与夹胸结合，练后20分钟快走"
                className={fieldCls}
              />
            </label>

            {/* 有氧设置 */}
            <div className="rounded-ctl bg-surface-subtle p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm2 font-semibold text-ink">
                  <Flame className="h-4 w-4 text-ink-3" /> 练后附加有氧
                </span>
              </div>
              <div className="mt-2">
                <SegmentedControl
                  label="练后附加有氧"
                  value={cardioValue}
                  onChange={(value) => {
                    if (value === 'custom') return;
                    setEditingPlan({ ...editingPlan, cardioMinutes: Number(value) });
                  }}
                  options={cardioOptions}
                />
              </div>

              {editingPlan.cardioMinutes > 0 && (
                <input
                  type="text"
                  value={editingPlan.cardioType || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, cardioType: e.target.value })}
                  placeholder="有氧项目: 跑步机坡度快走 / 爬楼机 / 椭圆机"
                  aria-label="有氧项目"
                  className={cx(compactFieldCls, 'mt-2')}
                />
              )}
            </div>

            {/* 动作列表编辑与重量预设 */}
            <div>
              <p className="text-body font-semibold text-ink">
                动作编排与预设重量 · {editingPlan.exercises.length} 个
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsImportSessionOpen(true); setImportSearch(''); }}
                >
                  从过往训练导入
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsSelectExOpen(true)}
                >
                  <Plus className="h-4 w-4" /> 挑选动作
                </Button>
              </div>

              {editingPlan.exercises.length === 0 ? (
                <div className="mt-3 rounded-ctl border border-dashed border-line-strong bg-surface-subtle px-3 py-6 text-center text-sm2 text-ink-3">
                  还没有添加动作，点击上方“挑选动作”添加
                </div>
              ) : (
                <div className="mt-2 border-t border-line">
                  {editingPlan.exercises.map((pe, idx) => {
                    const ex = allExercises.find(e => e.id === pe.exerciseId);
                    const unitLabel = pe.targetUnit === 'plates' ? '片' : pe.targetUnit === 'assisted' ? 'kg 助力' : pe.targetUnit === 'bodyweight' ? '自重' : 'kg';
                    return (
                      <div
                        key={`${pe.exerciseId}-${idx}`}
                        className="border-b border-line py-3 last:border-b-0"
                      >
                        {/* 动作头部 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="shrink-0 text-cap font-semibold tabular-nums text-ink-3">{idx + 1}.</span>
                              <span className="min-w-0 truncate text-body font-semibold text-ink">{ex?.name || '未知动作'}</span>
                              {pe.isDropSet && (
                                <Badge>
                                  <Flame className="h-3 w-3" />超级组
                                </Badge>
                              )}
                              {pe.isUnilateral && !pe.isDropSet && <Badge>左右独立</Badge>}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <IconButton
                              label={`上移第 ${idx + 1} 个动作`}
                              onClick={() => moveExercise(idx, 'up')}
                              disabled={idx === 0}
                              className="h-11 w-10 disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={`下移第 ${idx + 1} 个动作`}
                              onClick={() => moveExercise(idx, 'down')}
                              disabled={idx === editingPlan.exercises.length - 1}
                              className="h-11 w-10 disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={`移除第 ${idx + 1} 个动作`}
                              tone="danger"
                              onClick={() => removeExerciseFromPlan(idx)}
                              className="h-11 w-10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </div>

                        {/* 预设参数区：超级组面板 vs 普通动作面板 */}
                        {pe.isDropSet ? (
                          <div className="mt-2 rounded-ctl bg-surface-subtle p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-sm2 font-semibold text-ink">
                                <Flame className="h-4 w-4 text-ink-3" /> 超级组编排
                              </span>
                              <label className="flex items-center gap-1.5">
                                <span className="text-cap text-ink-3">目标大组</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  aria-label="目标大组数"
                                  value={pe.targetSets || ''}
                                  onChange={(e) => {
                                    const newExs = [...editingPlan.exercises];
                                    newExs[idx].targetSets = e.target.value === '' ? 0 : (parseInt(e.target.value) || 1);
                                    setEditingPlan({ ...editingPlan, exercises: newExs });
                                  }}
                                  className={cx(compactNumCls, 'w-14')}
                                />
                                <span className="text-cap text-ink-3">组</span>
                              </label>
                            </div>

                            {/* 递减阶梯列表 */}
                            <div className="mt-2 space-y-1">
                              {(pe.dropStages || []).map((stg, stgIdx) => (
                                <div
                                  key={stg.id}
                                  className="flex min-h-11 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2"
                                >
                                  <span className="w-5 shrink-0 text-cap font-semibold tabular-nums text-ink-3">#{stgIdx + 1}</span>
                                  <input
                                    type="number"
                                    step="0.5"
                                    aria-label={`第 ${stgIdx + 1} 阶重量`}
                                    value={stg.weightOrPlates || ''}
                                    onChange={(e) => {
                                      const newExs = [...editingPlan.exercises];
                                      newExs[idx].dropStages![stgIdx].weightOrPlates = parseFloat(e.target.value) || 0;
                                      setEditingPlan({ ...editingPlan, exercises: newExs });
                                    }}
                                    className={cx(compactNumCls, 'w-16')}
                                  />
                                  <span className="text-cap text-ink-3">kg</span>
                                  <span aria-hidden="true" className="text-cap text-ink-3">→</span>
                                  <input
                                    type="number"
                                    aria-label={`第 ${stgIdx + 1} 阶次数`}
                                    value={stg.reps || ''}
                                    onChange={(e) => {
                                      const newExs = [...editingPlan.exercises];
                                      newExs[idx].dropStages![stgIdx].reps = parseInt(e.target.value) || 0;
                                      setEditingPlan({ ...editingPlan, exercises: newExs });
                                    }}
                                    className={cx(compactNumCls, 'w-12')}
                                  />
                                  <span className="text-cap text-ink-3">次</span>
                                  {(pe.dropStages || []).length > 1 && (
                                    <IconButton
                                      label={`删除第 ${stgIdx + 1} 阶`}
                                      tone="danger"
                                      onClick={() => {
                                        const newExs = [...editingPlan.exercises];
                                        newExs[idx].dropStages!.splice(stgIdx, 1);
                                        setEditingPlan({ ...editingPlan, exercises: newExs });
                                      }}
                                      className="ml-auto h-10 w-10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </IconButton>
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const newExs = [...editingPlan.exercises];
                                  if (!newExs[idx].dropStages) newExs[idx].dropStages = [];
                                  const last = newExs[idx].dropStages![newExs[idx].dropStages!.length - 1];
                                  newExs[idx].dropStages!.push({
                                    id: `stg-${Date.now()}`,
                                    weightOrPlates: last ? Math.max(1, last.weightOrPlates - 2.5) : 5,
                                    unit: 'kg',
                                    reps: 10,
                                  });
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className="flex h-11 items-center gap-1 text-sm2 font-semibold text-accent"
                              >
                                <Plus className="h-4 w-4" /> 加一阶递减重量
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newExs = [...editingPlan.exercises];
                                  newExs[idx].isDropSet = false;
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className="h-11 shrink-0 px-1 text-cap text-ink-3 underline"
                              >
                                切回普通单组模式
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 普通动作配置面板 */
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-cap font-semibold text-ink-3">目标组数</span>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                aria-label="目标组数"
                                value={pe.targetSets || ''}
                                onChange={(e) => {
                                  const newExs = [...editingPlan.exercises];
                                  newExs[idx].targetSets = e.target.value === '' ? 0 : (parseInt(e.target.value) || 1);
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className={numFieldCls}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-1 block text-cap font-semibold text-ink-3">目标次数</span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                aria-label="目标次数"
                                value={pe.targetReps ?? ''}
                                placeholder="12"
                                onChange={(e) => {
                                  const newExs = [...editingPlan.exercises];
                                  newExs[idx].targetReps = e.target.value === '' ? undefined : (parseInt(e.target.value) || 1);
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className={numFieldCls}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-1 block text-cap font-semibold text-ink-3">预设负荷（{unitLabel}）</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                aria-label="预设负荷"
                                value={pe.targetWeight ?? ''}
                                onChange={(e) => {
                                  const newExs = [...editingPlan.exercises];
                                  newExs[idx].targetWeight = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className={numFieldCls}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-1 block text-cap font-semibold text-ink-3">阻力单位</span>
                              <select
                                value={pe.targetUnit || ex?.defaultUnit || 'kg'}
                                aria-label="阻力单位"
                                onChange={(e) => {
                                  const newExs = [...editingPlan.exercises];
                                  newExs[idx].targetUnit = e.target.value as ResistanceUnit;
                                  setEditingPlan({ ...editingPlan, exercises: newExs });
                                }}
                                className={fieldCls}
                              >
                                <option value="kg">kg (重量)</option>
                                <option value="plates">片 (插销)</option>
                                <option value="assisted">助力 (kg)</option>
                                <option value="bodyweight">自重</option>
                              </select>
                            </label>

                            {/* 左右独立（单侧）开关：仅普通动作提供，超级组不支持分侧 */}
                            <button
                              type="button"
                              aria-pressed={Boolean(pe.isUnilateral)}
                              aria-label="左右独立记录"
                              onClick={() => {
                                const newExs = [...editingPlan.exercises];
                                newExs[idx].isUnilateral = newExs[idx].isUnilateral ? undefined : true;
                                setEditingPlan({ ...editingPlan, exercises: newExs });
                              }}
                              className={cx(
                                'col-span-2 flex min-h-11 items-center justify-between gap-3 rounded-ctl border px-3 py-2 text-left transition-colors',
                                pe.isUnilateral ? 'border-line-strong bg-surface-subtle' : 'border-line bg-surface',
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm2 font-semibold text-ink">左右独立</span>
                                <span className="block text-cap text-ink-3">左右分别记录；与超级组互斥</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className={cx(
                                    'relative h-6 w-10 rounded-full transition-colors',
                                    pe.isUnilateral ? 'bg-ink' : 'bg-surface-strong',
                                  )}
                                >
                                  <span
                                    className={cx(
                                      'absolute top-0.5 h-5 w-5 rounded-full border border-line transition-all',
                                      pe.isUnilateral ? 'left-[1.125rem] bg-surface' : 'left-0.5 bg-surface',
                                    )}
                                  />
                                </span>
                                <span className={cx('text-cap font-semibold', pe.isUnilateral ? 'text-ink' : 'text-ink-3')}>
                                  {pe.isUnilateral ? '开' : '关'}
                                </span>
                              </span>
                            </button>
                          </div>
                        )}

                        {/* 动作底部：设为超级组按钮（超级组不支持分侧，切换时清除单侧标记） */}
                        {!pe.isDropSet && (
                          <div className="mt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const newExs = [...editingPlan.exercises];
                                newExs[idx].isDropSet = true;
                                // 超级组不支持分侧记录，切为超级组时清除单侧标记
                                newExs[idx].isUnilateral = undefined;
                                if (!newExs[idx].dropStages) {
                                  newExs[idx].dropStages = [
                                    { id: 'stg-1', weightOrPlates: 10, unit: 'kg', reps: 12 },
                                    { id: 'stg-2', weightOrPlates: 7.5, unit: 'kg', reps: 12 },
                                    { id: 'stg-3', weightOrPlates: 5, unit: 'kg', reps: 10 },
                                    { id: 'stg-4', weightOrPlates: 2.5, unit: 'kg', reps: 12 },
                                  ];
                                }
                                setEditingPlan({ ...editingPlan, exercises: newExs });
                              }}
                              className="flex h-11 items-center gap-1 px-1 text-sm2 font-semibold text-accent"
                            >
                              <Flame className="h-4 w-4" /> 设为超级组
                            </button>
                          </div>
                        )}

                        {/* 滑轮与备注可选行 */}
                        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <label className="flex shrink-0 items-center gap-2">
                            <span className="text-cap font-semibold text-ink-3">滑轮</span>
                            <select
                              value={pe.pulleyRatio || ex?.defaultPulley || 'none'}
                              aria-label="滑轮比例"
                              onChange={(e) => {
                                const newExs = [...editingPlan.exercises];
                                newExs[idx].pulleyRatio = e.target.value as PulleyRatio;
                                setEditingPlan({ ...editingPlan, exercises: newExs });
                              }}
                              className={compactSelectCls}
                            >
                              <option value="none">普通器械</option>
                              <option value="1:1">单滑轮 (1:1)</option>
                              <option value="2:1">双滑轮 (2:1)</option>
                            </select>
                          </label>
                          <input
                            type="text"
                            value={pe.notes || ''}
                            onChange={(e) => {
                              const newExs = [...editingPlan.exercises];
                              newExs[idx].notes = e.target.value;
                              setEditingPlan({ ...editingPlan, exercises: newExs });
                            }}
                            placeholder="动作小贴士 (如: 顶峰停顿1秒/热身组)"
                            aria-label="动作小贴士"
                            className={compactFieldCls}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* 选择动作加入计划 Sheet */}
      <Sheet
        open={isSelectExOpen}
        onClose={closeSelectExSheet}
        title="挑选动作加入计划"
        size="lg"
      >
        <input
          type="text"
          placeholder="搜索动作名称..."
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
          aria-label="搜索动作"
          className={fieldCls}
        />

        <div className="mt-2">
          {filteredExercises.map(e => {
            const cat = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.chest;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => handleAddExerciseToPlan(e)}
                className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-line px-1 py-2 text-left last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-body font-semibold text-ink">{e.name}</span>
                    <Badge>{cat.label}</Badge>
                  </span>
                  <span className="mt-0.5 block text-cap text-ink-3">默认: {UNIT_LABELS[e.defaultUnit]}</span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-ink-3" />
              </button>
            );
          })}
          {filteredExercises.length === 0 && (
            <p className="py-6 text-center text-sm2 text-ink-3">没有匹配的动作</p>
          )}
        </div>
      </Sheet>

      {/* 从过往训练导入模板 Sheet */}
      <Sheet
        open={isImportSessionOpen}
        onClose={closeImportSheet}
        title="从过往训练导入"
        description="取该场已完成组的重量次数做计划预设，导入后会替换当前动作编排"
        size="lg"
      >
        <input
          type="text"
          placeholder="搜索计划名或日期..."
          value={importSearch}
          onChange={(e) => setImportSearch(e.target.value)}
          aria-label="搜索过往训练"
          className={fieldCls}
        />

        <div className="mt-2">
          {importSessions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleImportSession(s.id)}
              className="flex min-h-14 w-full flex-col justify-center gap-0.5 border-b border-line px-1 py-2 text-left last:border-b-0"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-body font-semibold text-ink">{displayPlanName(s.planName)}</span>
                <Badge>{s.date}</Badge>
              </span>
              <span className="block truncate text-cap text-ink-3">
                {s.exercises.length} 个动作 · {s.exercises.map(e => e.exerciseName).join('、')}
              </span>
            </button>
          ))}
          {importSessions.length === 0 && (
            <p className="py-6 text-center text-sm2 text-ink-3">没有匹配的训练记录</p>
          )}
        </div>
      </Sheet>

      {/* 统一确认抽屉 */}
      <ConfirmSheet
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText="确认删除"
        danger
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
};
