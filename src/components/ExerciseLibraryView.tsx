import { useState } from 'react';
import {
  Search, Plus, X, Edit3, Trash2, ArrowLeftRight, Flame, Check, Star, AlertCircle
} from 'lucide-react';
import {
  Exercise, MuscleCategory, ResistanceUnit, PulleyRatio, DropStage,
  CATEGORY_LABELS, UNIT_LABELS
} from '../types';
import { StorageService } from '../utils/storage';
import { ConfirmSheet } from './ConfirmSheet';
import { Badge, Button, IconButton, Sheet, cx } from '../ui';

interface ExerciseLibraryViewProps {
  exercises: Exercise[];
  onRefreshExercises: () => void;
}

// 输入框统一样式：与 WorkoutView 的 fieldCls 保持一致
const fieldCls = 'h-11 w-full rounded-ctl border border-line bg-surface-subtle px-3 text-body text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/15';

// 递减超级组默认阶梯：10 / 7.5 / 5 / 2.5 kg（与计划页默认一致）
const DEFAULT_DROP_STAGES: DropStage[] = [
  { id: 'stg-1', weightOrPlates: 10, unit: 'kg', reps: 12 },
  { id: 'stg-2', weightOrPlates: 7.5, unit: 'kg', reps: 12 },
  { id: 'stg-3', weightOrPlates: 5, unit: 'kg', reps: 10 },
  { id: 'stg-4', weightOrPlates: 2.5, unit: 'kg', reps: 12 },
];

// 深拷贝默认阶梯，避免多个动作共享同一数组引用，并生成唯一 id
const makeDefaultDropStages = (): DropStage[] =>
  DEFAULT_DROP_STAGES.map((stg, i) => ({ ...stg, id: `stg-${Date.now()}-${i}` }));

export const ExerciseLibraryView: React.FC<ExerciseLibraryViewProps> = ({
  exercises,
  onRefreshExercises,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 新增动作表单状态
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MuscleCategory>('chest');
  const [newUnit, setNewUnit] = useState<ResistanceUnit>('plates');
  const [newPulley, setNewPulley] = useState<PulleyRatio>('none');
  const [newUnilateral, setNewUnilateral] = useState(false);
  // 超级组标记与阶梯（与单侧互斥）
  const [newDropSet, setNewDropSet] = useState(false);
  const [newDropStages, setNewDropStages] = useState<DropStage[]>([]);
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // 编辑模式：非空表示正在编辑该自建动作，否则为新增
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  // 删除被计划引用时的拦截提示
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; confirmText: string; onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmText: '确认删除', onConfirm: () => {} });

  const categories: { key: string; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'chest', label: '胸部' },
    { key: 'back', label: '背部' },
    { key: 'shoulder', label: '肩部' },
    { key: 'leg', label: '腿部' },
    { key: 'biceps', label: '肱二头' },
    { key: 'triceps', label: '肱三头' },
    { key: 'abs', label: '腹部核心' },
    { key: 'cardio', label: '有氧' },
  ];

  const filteredExercises = exercises.filter(ex => {
    const matchCat = selectedCategory === 'all' || ex.category === selectedCategory;
    const matchSearch = !searchTerm || 
      ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ex.notes && ex.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchSearch;
  });

  // 按部位分组：沿用筛选条顺序作为分组顺序；
  // 组内内置动作在前、用户自建动作在后，各自保持原有相对次序（稳定排序）。
  const groupedExercises = categories
    .filter(c => c.key !== 'all')
    .map(c => {
      const items = filteredExercises
        .filter(ex => ex.category === c.key)
        .slice()
        .sort((a, b) => Number(Boolean(a.isCustom)) - Number(Boolean(b.isCustom)));
      return { key: c.key, label: c.label, items };
    })
    .filter(g => g.items.length > 0);

  // 打开新增弹窗：清空表单并退出编辑模式
  const openAddModal = () => {
    setEditingExercise(null);
    setNewName('');
    setNewCategory('chest');
    setNewUnit('plates');
    setNewPulley('none');
    setNewUnilateral(false);
    setNewDropSet(false);
    setNewDropStages([]);
    setNewNotes('');
    setFormError(null);
    setLibraryNotice(null);
    setIsAddModalOpen(true);
  };

  // 打开编辑弹窗：回填该自建动作的当前字段
  const openEditModal = (ex: Exercise) => {
    setEditingExercise(ex);
    setNewName(ex.name);
    setNewCategory(ex.category);
    setNewUnit(ex.defaultUnit);
    setNewPulley(ex.defaultPulley || 'none');
    setNewUnilateral(Boolean(ex.isUnilateral));
    const hasDrop = Boolean(ex.isDropSet);
    setNewDropSet(hasDrop);
    setNewDropStages(
      hasDrop && ex.dropStages && ex.dropStages.length > 0
        ? JSON.parse(JSON.stringify(ex.dropStages))
        : []
    );
    setNewNotes(ex.notes || '');
    setFormError(null);
    setLibraryNotice(null);
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingExercise(null);
  };

  // 训练方式两张可选卡互斥切换（与 WorkoutView 自定义动作表单一致）
  const toggleUnilateral = () => {
    const next = !newUnilateral;
    setNewUnilateral(next);
    if (next) setNewDropSet(false);
  };

  const toggleDropSet = () => {
    const next = !newDropSet;
    setNewDropSet(next);
    if (next) {
      setNewUnilateral(false);
      setNewDropStages(prev => (prev.length > 0 ? prev : makeDefaultDropStages()));
    }
  };

  const handleCreateExercise = () => {
    if (!newName.trim()) {
      setFormError('请输入动作名称！');
      return;
    }
    setFormError(null);

    // 编辑内置动作：名称与目标肌肉群保持原值，不允许改动
    const isBuiltinEdit = Boolean(editingExercise && !editingExercise.isCustom);

    // 超级组分支：清洗阶梯数字，无效值回退为 0；阶梯为空时回落到默认四阶
    const dropStages: DropStage[] | undefined = newDropSet
      ? (newDropStages.length > 0 ? newDropStages : makeDefaultDropStages()).map(stg => ({
          id: stg.id || `stg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          weightOrPlates: typeof stg.weightOrPlates === 'number' && stg.weightOrPlates >= 0 ? stg.weightOrPlates : 0,
          reps: typeof stg.reps === 'number' && stg.reps >= 0 ? Math.floor(stg.reps) : 0,
          unit: stg.unit || 'kg',
        }))
      : undefined;

    const payload = {
      name: isBuiltinEdit ? editingExercise!.name : newName.trim(),
      category: isBuiltinEdit ? editingExercise!.category : newCategory,
      defaultUnit: newUnit,
      defaultPulley: newPulley,
      // 超级组与单侧互斥：开启超级组时不写入单侧标记
      isUnilateral: newDropSet ? undefined : (newUnilateral || undefined),
      isDropSet: newDropSet || undefined,
      dropStages,
      notes: newNotes.trim() || undefined,
    };

    if (editingExercise) {
      // 编辑动作：就地更新同 id 记录，保持其在列表中的位置（内置动作不改变 isCustom 标记）
      const list = StorageService.getExercises();
      StorageService.saveExercises(
        list.map(e => (e.id === editingExercise.id ? { ...e, ...payload } : e))
      );
    } else {
      StorageService.addCustomExercise({ ...payload, isFavorite: true });
    }

    onRefreshExercises();
    closeModal();
  };

  // 删除自建动作：被任一计划引用时拦截，否则走统一确认抽屉
  const handleDeleteExercise = (ex: Exercise) => {
    setLibraryNotice(null);
    const usedBy = StorageService.getPlans()
      .filter(p => p.exercises.some(pe => pe.exerciseId === ex.id))
      .map(p => p.name);
    if (usedBy.length > 0) {
      setLibraryNotice(
        `无法删除 “${ex.name}”：该动作正被 ${usedBy.length} 个训练计划引用（${usedBy.join('、')}），请先在这些计划中移除后再删除。`
      );
      return;
    }
    setConfirmState({
      open: true,
      title: '删除自定义动作',
      description: `确定删除自定义动作 “${ex.name}” 吗？此操作无法撤销。`,
      confirmText: '确认删除',
      onConfirm: () => {
        const list = StorageService.getExercises();
        StorageService.saveExercises(list.filter(e => e.id !== ex.id));
        onRefreshExercises();
        setConfirmState(prev => ({ ...prev, open: false }));
      },
    });
  };

  const isBuiltinEdit = Boolean(editingExercise && !editingExercise.isCustom);

  return (
    <div className="pb-24 pt-2">
      {/* 头部：eyebrow + 页面标题 + 唯一主操作 */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 text-cap font-semibold tracking-[0.04em] text-ink-3">
          <span>FITCUSTOM PRO</span>
          <span>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            {' '}
            {new Date().toLocaleDateString('zh-CN', { weekday: 'short' })}
          </span>
        </div>
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h1 font-bold tracking-tight text-ink">动作库</h1>
            <p className="mt-1 text-sm2 text-ink-2">内置标准动作库，支持插销片数与滑轮倍率设置</p>
          </div>
          <Button variant="primary" onClick={openAddModal} className="shrink-0">
            <Plus className="h-4 w-4" /> 自定义动作
          </Button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative mt-4">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索动作名称、器械类型或备注..."
          aria-label="搜索动作"
          className={cx(fieldCls, 'pl-9 pr-12')}
        />
        {searchTerm && (
          <IconButton
            label="清除搜索"
            onClick={() => setSearchTerm('')}
            className="absolute right-0 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      {/* 部位筛选：36px chip 放在 ≥44px 触控行内 */}
      <div
        role="group"
        aria-label="部位筛选"
        className="scrollbar-none flex min-h-11 items-center gap-1.5 overflow-x-auto pb-1"
      >
        {categories.map((c) => {
          const active = selectedCategory === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(c.key)}
              className={cx(
                'h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-sm2 transition-colors',
                active
                  ? 'bg-ink font-semibold text-white'
                  : 'bg-surface-subtle font-medium text-ink-2 hover:text-ink',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* 删除拦截提示 */}
      {libraryNotice && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-ctl border border-danger/30 bg-danger-soft px-3 py-2"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="min-w-0 flex-1 text-cap leading-relaxed text-danger">{libraryNotice}</p>
          <IconButton
            label="关闭提示"
            tone="danger"
            onClick={() => setLibraryNotice(null)}
            className="-my-2 -mr-2"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {/* 动作列表：按部位分组，1px 分隔行 */}
      <div className="mt-4 space-y-5">
        <div className="flex items-center justify-between gap-2 text-cap text-ink-3">
          <span className="tabular-nums">共找到 {filteredExercises.length} 个动作</span>
          <span>按部位分组 · 内置优先</span>
        </div>

        {groupedExercises.length === 0 && (
          <div className="rounded-card border border-dashed border-line-strong bg-surface py-10 text-center">
            <Search aria-hidden="true" className="mx-auto h-6 w-6 text-ink-3" />
            <p className="mt-2 text-body text-ink-2">没有找到匹配的动作</p>
            <p className="mt-1 text-cap text-ink-3">换个关键词或切换部位再试</p>
          </div>
        )}

        {groupedExercises.map((group) => (
          <section key={group.key}>
            {/* 分组头：部位 · N 个 */}
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-cap font-semibold text-ink-3">
                {group.label} · {group.items.length} 个
              </h2>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>

            <div className="border-t border-line">
              {group.items.map((ex) => {
                const exCat = CATEGORY_LABELS[ex.category] || CATEGORY_LABELS.chest;
                const pulleyLabel = ex.defaultPulley && ex.defaultPulley !== 'none'
                  ? (ex.defaultPulley === '1:1' ? '单滑轮 1:1' : '双滑轮 2:1')
                  : null;
                return (
                  <div
                    key={ex.id}
                    className="flex items-start gap-2 border-b border-line py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-body font-semibold text-ink">{ex.name}</h3>
                        {ex.isFavorite && (
                          <span className="inline-flex items-center text-ink-3" title="已收藏">
                            <Star aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
                            <span className="sr-only">已收藏</span>
                          </span>
                        )}
                        <Badge>{exCat.label}</Badge>
                        {ex.isCustom && <Badge>用户自建</Badge>}
                        {ex.isUnilateral && (
                          <Badge>
                            <ArrowLeftRight aria-hidden="true" className="h-3 w-3" />左右独立
                          </Badge>
                        )}
                        {ex.isDropSet && (
                          <Badge>
                            <Flame aria-hidden="true" className="h-3 w-3" />
                            超级组{ex.dropStages && ex.dropStages.length > 0 ? ` · ${ex.dropStages.length} 阶` : ''}
                          </Badge>
                        )}
                      </div>

                      {/* 默认规格 */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-cap text-ink-3">
                        <span>计量: {UNIT_LABELS[ex.defaultUnit]}</span>
                        {pulleyLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{pulleyLabel}</span>
                          </>
                        )}
                      </div>

                      {ex.notes && (
                        <p className="line-clamp-2 text-cap leading-relaxed text-ink-3">{ex.notes}</p>
                      )}
                    </div>

                    {/* 编辑：全部动作可点（内置动作锁定名称与部位）；删除仅自建动作可见 */}
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        label={ex.isCustom ? '编辑自定义动作' : '编辑内置动作'}
                        onClick={() => openEditModal(ex)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                      {ex.isCustom && (
                        <IconButton
                          label="删除自定义动作"
                          tone="danger"
                          onClick={() => handleDeleteExercise(ex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* 新增 / 编辑动作 Sheet */}
      <Sheet
        open={isAddModalOpen}
        onClose={closeModal}
        size="lg"
        title={editingExercise ? '编辑动作' : '新增动作'}
        description={
          isBuiltinEdit
            ? '内置动作的名称与部位已锁定'
            : editingExercise
              ? '修改保存后立即同步到动作库'
              : '保存后立即加入动作库对应部位分组'
        }
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>
              取消
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleCreateExercise}>
              {editingExercise ? '保存修改' : '保存到动作库'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-cap font-semibold text-danger">
              {formError}
            </p>
          )}

          <div>
            <label htmlFor="library-exercise-name" className="mb-1 block text-cap font-semibold text-ink-2">
              动作名称 *
            </label>
            <input
              id="library-exercise-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              readOnly={isBuiltinEdit}
              placeholder="例如: 史密斯下斜推胸、六角杠深蹲..."
              className={cx(fieldCls, isBuiltinEdit && 'cursor-not-allowed text-ink-3')}
            />
            {isBuiltinEdit && (
              <p className="mt-1 text-cap text-ink-3">内置动作名称不可修改</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="library-exercise-category" className="mb-1 block text-cap font-semibold text-ink-2">
                目标肌肉群
              </label>
              <select
                id="library-exercise-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as MuscleCategory)}
                disabled={isBuiltinEdit}
                className={cx(fieldCls, isBuiltinEdit && 'cursor-not-allowed text-ink-3 opacity-70')}
              >
                <option value="chest">胸部</option>
                <option value="back">背部</option>
                <option value="shoulder">肩部</option>
                <option value="leg">腿部</option>
                <option value="biceps">肱二头</option>
                <option value="triceps">肱三头</option>
                <option value="abs">腹部核心</option>
                <option value="cardio">有氧训练</option>
              </select>
              {isBuiltinEdit && (
                <p className="mt-1 text-cap text-ink-3">内置动作部位不可修改</p>
              )}
            </div>

            <div>
              <label htmlFor="library-exercise-unit" className="mb-1 block text-cap font-semibold text-ink-2">
                默认计量维度
              </label>
              <select
                id="library-exercise-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as ResistanceUnit)}
                className={fieldCls}
              >
                <option value="plates">插销 (片)</option>
                <option value="kg">重量 (kg)</option>
                <option value="assisted">助力 (kg)</option>
                <option value="bodyweight">自重</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="library-exercise-pulley" className="mb-1 block text-cap font-semibold text-ink-2">
              滑轮类型 (针对绳索)
            </label>
            <select
              id="library-exercise-pulley"
              value={newPulley}
              onChange={(e) => setNewPulley(e.target.value as PulleyRatio)}
              className={fieldCls}
            >
              <option value="none">普通固定器械/自由重量</option>
              <option value="1:1">单滑轮 1:1</option>
              <option value="2:1">双滑轮 2:1</option>
            </select>
          </div>

          {/* 训练方式：左右独立 / 超级组 两张并排可选卡，互斥 */}
          <div>
            <p className="mb-1.5 text-cap font-semibold text-ink-2">训练方式</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={newUnilateral}
                onClick={toggleUnilateral}
                className={cx(
                  'flex min-h-16 flex-col items-start justify-center gap-1 rounded-ctl border px-3 py-2 text-left transition-colors',
                  newUnilateral ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                <span className="flex w-full items-center gap-1.5 text-sm2 font-semibold text-ink">
                  <ArrowLeftRight className={cx('h-4 w-4', newUnilateral ? 'text-accent' : 'text-ink-3')} />
                  左右独立
                  {newUnilateral && <Check className="ml-auto h-4 w-4 text-accent" />}
                </span>
                <span className="text-cap text-ink-3">左右分别记录</span>
              </button>

              <button
                type="button"
                aria-pressed={newDropSet}
                onClick={toggleDropSet}
                className={cx(
                  'flex min-h-16 flex-col items-start justify-center gap-1 rounded-ctl border px-3 py-2 text-left transition-colors',
                  newDropSet ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
                )}
              >
                <span className="flex w-full items-center gap-1.5 text-sm2 font-semibold text-ink">
                  <Flame className={cx('h-4 w-4', newDropSet ? 'text-accent' : 'text-ink-3')} />
                  超级组
                  {newDropSet && <Check className="ml-auto h-4 w-4 text-accent" />}
                </span>
                <span className="text-cap text-ink-3">自动 4 阶递减</span>
              </button>
            </div>
            <p className="mt-1.5 text-cap text-ink-3">两种方式互斥，也可都不选</p>
          </div>

          {/* 超级组阶梯编辑器：紧凑输入行（阶号 + 重量 + 单位 + 次数） */}
          {newDropSet && (
            <div className="rounded-ctl border border-line bg-surface">
              <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line px-3">
                <span className="text-cap font-semibold text-ink-3">递减阶梯编排</span>
                <button
                  type="button"
                  onClick={() => setNewDropStages(makeDefaultDropStages())}
                  className="h-11 shrink-0 px-1 text-cap font-semibold text-ink-3 underline hover:text-ink-2"
                >
                  重置默认四阶
                </button>
              </div>

              <div>
                {newDropStages.map((stg, stgIdx) => (
                  <div
                    key={stg.id}
                    className="flex min-h-12 items-center gap-2 border-b border-line px-3 py-1 last:border-b-0"
                  >
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-surface-subtle text-cap font-semibold tabular-nums text-ink-3">
                      {stgIdx + 1}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      aria-label={`第 ${stgIdx + 1} 阶重量`}
                      value={stg.weightOrPlates || ''}
                      onChange={(e) => setNewDropStages(prev =>
                        prev.map((s, i) => i === stgIdx ? { ...s, weightOrPlates: parseFloat(e.target.value) || 0 } : s)
                      )}
                      className="h-10 w-14 rounded-[6px] border border-line bg-surface px-1 text-center text-h2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
                    />
                    <span className="shrink-0 text-sm2 text-ink-2">
                      {stg.unit === 'plates' ? '片' : 'kg'} ×
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`第 ${stgIdx + 1} 阶次数`}
                      value={stg.reps || ''}
                      onChange={(e) => setNewDropStages(prev =>
                        prev.map((s, i) => i === stgIdx ? { ...s, reps: parseInt(e.target.value) || 0 } : s)
                      )}
                      className="h-10 w-10 rounded-[6px] border border-line bg-surface px-1 text-center text-sm2 font-semibold tabular-nums text-ink focus:border-accent focus:outline-none"
                    />
                    <span className="shrink-0 text-sm2 text-ink-2">次</span>
                    {newDropStages.length > 1 && (
                      <IconButton
                        label={`删除第 ${stgIdx + 1} 阶`}
                        onClick={() => setNewDropStages(prev => prev.filter((_, i) => i !== stgIdx))}
                        className="ml-auto h-10 w-10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setNewDropStages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev, {
                    id: `stg-${Date.now()}`,
                    weightOrPlates: last ? Math.max(0, last.weightOrPlates - 2.5) : 5,
                    unit: 'kg',
                    reps: 10,
                  }];
                })}
                className="flex h-11 w-full items-center gap-1 border-t border-line px-3 text-sm2 font-semibold text-accent"
              >
                <Plus className="h-4 w-4" /> 加一阶递减
              </button>
            </div>
          )}

          <div>
            <label htmlFor="library-exercise-notes" className="mb-1 block text-cap font-semibold text-ink-2">
              动作要领或器械备注
            </label>
            <input
              id="library-exercise-notes"
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="例如: 某某牌器械3号机、沉肩挺胸..."
              className={fieldCls}
            />
          </div>
        </div>
      </Sheet>

      {/* 统一确认抽屉 */}
      <ConfirmSheet
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        danger
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
};
