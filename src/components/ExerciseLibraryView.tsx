import { useState } from 'react';
import { 
  Search, Plus, X 
} from 'lucide-react';
import { 
  Exercise, MuscleCategory, ResistanceUnit, PulleyRatio, 
  CATEGORY_LABELS, UNIT_LABELS 
} from '../types';
import { StorageService } from '../utils/storage';

interface ExerciseLibraryViewProps {
  exercises: Exercise[];
  onRefreshExercises: () => void;
}

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
  const [newNotes, setNewNotes] = useState('');

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

  const handleCreateExercise = () => {
    if (!newName.trim()) {
      alert('请输入动作名称！');
      return;
    }

    StorageService.addCustomExercise({
      name: newName.trim(),
      category: newCategory,
      defaultUnit: newUnit,
      defaultPulley: newPulley,
      notes: newNotes.trim() || undefined,
      isFavorite: true,
    });

    onRefreshExercises();
    setIsAddModalOpen(false);
    setNewName('');
    setNewNotes('');
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
          onClick={() => setIsAddModalOpen(true)}
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

      {/* 动作列表卡片 */}
      <div className="space-y-2.5">
        <div className="text-[11px] text-slate-400 font-medium px-1 flex items-center justify-between">
          <span>共找到 {filteredExercises.length} 个动作</span>
          <span>包含插销片数/滑轮比例信息</span>
        </div>

        {filteredExercises.map((ex) => {
          const cat = CATEGORY_LABELS[ex.category] || CATEGORY_LABELS.chest;
          return (
            <div
              key={ex.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-3.5 hover:border-slate-300 shadow-sm transition-all flex items-start justify-between gap-3"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{ex.name}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color}`}>
                    {cat.label}
                  </span>
                  {ex.isCustom && (
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-medium">
                      用户自建
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
            </div>
          );
        })}
      </div>

      {/* 新增自定义动作模态框 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">添加自定义健身动作</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">动作名称 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: 史密斯下斜推胸、六角杠深蹲..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">目标肌肉群</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MuscleCategory)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
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
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateExercise}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
              >
                保存到动作库
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
