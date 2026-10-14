import { useState } from 'react';
import { 
  Search, Plus, X, Edit3, Trash2, ArrowLeftRight 
} from 'lucide-react';
import { 
  Exercise, MuscleCategory, ResistanceUnit, PulleyRatio, DropStage,
  CATEGORY_LABELS, UNIT_LABELS 
} from '../types';
import { StorageService } from '../utils/storage';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';
import { ConfirmSheet } from './ConfirmSheet';

interface ExerciseLibraryViewProps {
  exercises: Exercise[];
  onRefreshExercises: () => void;
}

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

  // 弹窗打开时锁定底层滚动
  useLockBodyScroll(isAddModalOpen || confirmState.open);

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

  return (
    <div className="pb-24 pt-2">
      {/* 头部标题与新建动作 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">动作库</h1>
          <p className="text-xs text-slate-500 mt-0.5">内置标准动作库，支持插销片数与滑轮倍率设置</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> 自定义动作
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索动作名称、器械类型或备注..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 部位横向筛选滑动条 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === c.key
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shadow-sm'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 删除拦截提示 */}
      {libraryNotice && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold text-red-700 leading-relaxed flex-1">{libraryNotice}</span>
          <button
            onClick={() => setLibraryNotice(null)}
            className="text-red-400 hover:text-red-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 动作列表卡片：按部位分组 */}
      <div className="space-y-4">
        <div className="text-[11px] text-slate-400 font-medium px-1 flex items-center justify-between">
          <span>共找到 {filteredExercises.length} 个动作</span>
          <span>按部位分组 · 内置优先</span>
        </div>

        {groupedExercises.length === 0 && (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs bg-white">
            没有找到匹配的动作，换个关键词试试
          </div>
        )}

        {groupedExercises.map((group) => {
          const cat = CATEGORY_LABELS[group.key as MuscleCategory] || CATEGORY_LABELS.chest;
          return (
            <div key={group.key} className="space-y-2.5">
              {/* 分组头：部位名 + 计数 */}
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color}`}>
                  {group.label}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {group.items.length} 个动作
                </span>
                <div className="flex-1 h-px bg-slate-200/80" />
              </div>

              {group.items.map((ex) => {
                const exCat = CATEGORY_LABELS[ex.category] || CATEGORY_LABELS.chest;
                return (
                  <div
                    key={ex.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-3.5 hover:border-slate-300 shadow-sm transition-all flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{ex.name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${exCat.bg} ${exCat.color}`}>
                          {exCat.label}
                        </span>
                        {ex.isCustom && (
                          <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-medium">
                            用户自建
                          </span>
                        )}
                        {ex.isUnilateral && (
                          <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200 font-semibold flex items-center gap-0.5">
                            <ArrowLeftRight className="w-3 h-3" /> 左右独立
                          </span>
                        )}
                        {ex.isDropSet && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                            🔥 超级组{ex.dropStages && ex.dropStages.length > 0 ? ` · ${ex.dropStages.length}阶` : ''}
                          </span>
                        )}
                      </div>

                      {/* 属性标签：默认单位、滑轮 */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                          计量: {UNIT_LABELS[ex.defaultUnit]}
                        </span>

                        {ex.defaultPulley && ex.defaultPulley !== 'none' && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 font-semibold">
                            {ex.defaultPulley === '1:1' ? '单滑轮 (1:1)' : '双滑轮 (2:1)'}
                          </span>
                        )}
                      </div>

                      {ex.notes && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          💡 {ex.notes}
                        </p>
                      )}
                    </div>

                    {/* 编辑：全部动作可点（内置动作锁定名称与部位）；删除仅自建动作可见 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(ex)}
                        className="p-1.5 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                        title={ex.isCustom ? '编辑该自定义动作' : '编辑该内置动作'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {ex.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex)}
                          className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="删除该自定义动作"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 新增自定义动作模态框 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[max(env(safe-area-inset-top),46px)]">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)] overflow-y-auto modal-scroll overscroll-contain p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {editingExercise
                  ? (editingExercise.isCustom ? '编辑自定义健身动作' : '编辑内置动作（名称与部位锁定）')
                  : '添加自定义健身动作'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {formError && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  {formError}
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">动作名称 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  readOnly={Boolean(editingExercise && !editingExercise.isCustom)}
                  placeholder="例如: 史密斯下斜推胸、六角杠深蹲..."
                  className={`w-full border rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 ${
                    editingExercise && !editingExercise.isCustom
                      ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                  }`}
                />
                {editingExercise && !editingExercise.isCustom && (
                  <p className="text-[10px] text-slate-400 mt-1">内置动作名称不可修改</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">目标肌肉群</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MuscleCategory)}
                  disabled={Boolean(editingExercise && !editingExercise.isCustom)}
                  className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${
                    editingExercise && !editingExercise.isCustom
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 text-slate-900 focus:bg-white'
                  }`}
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
                {editingExercise && !editingExercise.isCustom && (
                  <p className="text-[10px] text-slate-400 mt-1">内置动作部位不可修改</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">默认计量维度</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as ResistanceUnit)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="plates">插销 (片)</option>
                    <option value="kg">重量 (kg)</option>
                    <option value="assisted">助力 (kg)</option>
                    <option value="bodyweight">自重</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">滑轮类型 (针对绳索)</label>
                  <select
                    value={newPulley}
                    onChange={(e) => setNewPulley(e.target.value as PulleyRatio)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="none">普通固定器械/自由重量</option>
                    <option value="1:1">单滑轮 1:1</option>
                    <option value="2:1">双滑轮 2:1</option>
                  </select>
                </div>
              </div>

              {/* 左右独立（单侧）开关：开启时清除超级组标记（两者互斥） */}
              <button
                type="button"
                onClick={() => setNewUnilateral(v => {
                  const next = !v;
                  if (next) setNewDropSet(false);
                  return next;
                })}
                className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-left"
              >
                <span className="flex items-start gap-2">
                  <ArrowLeftRight className={`w-4 h-4 mt-0.5 shrink-0 ${newUnilateral ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>
                    <span className="block text-xs font-bold text-slate-700">左右独立动作（单侧）</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">开启后训练时左右分别记录重量与次数</span>
                  </span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${newUnilateral ? 'bg-teal-600' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${newUnilateral ? 'left-[1.125rem]' : 'left-0.5'}`}
                  />
                </span>
              </button>

              {/* 递减超级组开关：开启时清除单侧标记（两者互斥） */}
              <button
                type="button"
                onClick={() => setNewDropSet(v => {
                  const next = !v;
                  if (next) {
                    setNewUnilateral(false);
                    setNewDropStages(prev => (prev.length > 0 ? prev : makeDefaultDropStages()));
                  }
                  return next;
                })}
                className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-left"
              >
                <span className="flex items-start gap-2">
                  <span className={`text-base leading-5 ${newDropSet ? '' : 'grayscale opacity-60'}`}>🔥</span>
                  <span>
                    <span className="block text-xs font-bold text-slate-700">递减超级组</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">标记后按超级组编排，可预设递减阶梯（不支持分侧）</span>
                  </span>
                </span>
                <span
                  className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${newDropSet ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${newDropSet ? 'left-[1.125rem]' : 'left-0.5'}`}
                  />
                </span>
              </button>

              {/* 超级组阶梯编辑器 */}
              {newDropSet && (
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900">递减阶梯编排</span>
                    <span className="text-[10px] text-slate-500">默认 10 / 7.5 / 5 / 2.5 kg</span>
                  </div>
                  <div className="space-y-1">
                    {newDropStages.map((stg, stgIdx) => (
                      <div
                        key={stg.id}
                        className="bg-white p-1.5 rounded-lg border border-amber-200/80 flex items-center justify-between text-[11px] gap-1"
                      >
                        <span className="font-mono text-slate-400 font-bold w-4">#{stgIdx + 1}</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            step="0.5"
                            value={stg.weightOrPlates || ''}
                            onChange={(e) => setNewDropStages(prev =>
                              prev.map((s, i) => i === stgIdx ? { ...s, weightOrPlates: parseFloat(e.target.value) || 0 } : s)
                            )}
                            className="w-12 bg-slate-50 border border-slate-200 rounded py-0.5 text-center font-black text-slate-900"
                          />
                          <span className="text-slate-400 font-bold">kg</span>
                        </div>
                        <span className="text-slate-300">➔</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            value={stg.reps || ''}
                            onChange={(e) => setNewDropStages(prev =>
                              prev.map((s, i) => i === stgIdx ? { ...s, reps: parseInt(e.target.value) || 0 } : s)
                            )}
                            className="w-10 bg-slate-50 border border-slate-200 rounded py-0.5 text-center font-black text-slate-900"
                          />
                          <span className="text-slate-400 font-bold">次</span>
                        </div>
                        {newDropStages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewDropStages(prev => prev.filter((_, i) => i !== stgIdx))}
                            className="text-slate-300 hover:text-red-500 p-0.5 ml-1"
                            title="删除该阶"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
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
                      className="text-[11px] text-amber-800 hover:text-amber-900 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> 加一阶递减
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDropStages(makeDefaultDropStages())}
                      className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                    >
                      重置默认四阶
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">动作要领或器械备注</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="例如: 某某牌器械3号机、沉肩挺胸..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateExercise}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
              >
                {editingExercise ? '保存修改' : '保存到动作库'}
              </button>
            </div>
          </div>
        </div>
      )}

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
