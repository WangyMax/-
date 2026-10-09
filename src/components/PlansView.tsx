import { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, Copy, Play, 
  Flame, ArrowUp, ArrowDown, X
} from 'lucide-react';
import { WorkoutPlan, Exercise, PlanExerciseTarget, CATEGORY_LABELS } from '../types';
import { StorageService } from '../utils/storage';

interface PlansViewProps {
  allExercises: Exercise[];
  onStartPlan: (plan: WorkoutPlan) => void;
}

export const PlansView: React.FC<PlansViewProps> = ({
  allExercises,
  onStartPlan
}) => {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectExOpen, setIsSelectExOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  useEffect(() => {
    setPlans(StorageService.getPlans());
  }, []);

  const refreshPlans = () => {
    setPlans(StorageService.getPlans());
  };

  // 打开创建新计划
  const handleOpenCreate = () => {
    const newPlan: WorkoutPlan = {
      id: `plan-${Date.now()}`,
      name: '',
      categoryTags: ['力量训练'],
      description: '',
      exercises: [],
      cardioMinutes: 20,
      cardioType: '跑步机坡度快走',
    };
    setEditingPlan(newPlan);
    setIsModalOpen(true);
  };

  // 打开编辑已有计划
  const handleOpenEdit = (plan: WorkoutPlan) => {
    setEditingPlan(JSON.parse(JSON.stringify(plan)));
    setIsModalOpen(true);
  };

  // 复制计划
  const handleDuplicate = (plan: WorkoutPlan) => {
    const copy: WorkoutPlan = {
      ...JSON.parse(JSON.stringify(plan)),
      id: `plan-${Date.now()}`,
      name: `${plan.name} (副本)`,
    };
    StorageService.savePlan(copy);
    refreshPlans();
  };

  // 删除计划
  const handleDelete = (planId: string) => {
    if (window.confirm('确定删除该训练计划吗？')) {
      StorageService.deletePlan(planId);
      refreshPlans();
    }
  };

  // 保存计划
  const handleSavePlan = () => {
    if (!editingPlan) return;
    if (!editingPlan.name.trim()) {
      alert('请输入计划名称！');
      return;
    }
    StorageService.savePlan(editingPlan);
    refreshPlans();
    setIsModalOpen(false);
    setEditingPlan(null);
  };

  // 在编辑中添加动作
  const handleAddExerciseToPlan = (exercise: Exercise) => {
    if (!editingPlan) return;
    const newTarget: PlanExerciseTarget = {
      exerciseId: exercise.id,
      targetSets: 4,
      targetReps: 12,
      notes: exercise.notes || ''
    };
    setEditingPlan({
      ...editingPlan,
      exercises: [...editingPlan.exercises, newTarget]
    });
    setIsSelectExOpen(false);
  };

  // 调整动作排序
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

  return (
    <div className="pb-24 pt-2">
      {/* 头部标题与新建按钮 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">自定义训练计划</h1>
          <p className="text-xs text-slate-500 mt-0.5">自主编排分化循环，灵活设定动作与目标</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> 新建计划
        </button>
      </div>

      {/* 计划列表 */}
      <div className="space-y-4">
        {plans.map((plan) => {
          const isLeg = plan.name.includes('腿');
          return (
            <div
              key={plan.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-slate-300 hover:shadow transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{plan.name}</h3>
                    {isLeg ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        下肢专注 · 无有氧
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 flex items-center gap-1">
                        <Flame className="w-2.5 h-2.5" /> 附加 {plan.cardioMinutes}m 有氧
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                  )}
                </div>

                {/* 快捷开练大按钮 */}
                <button
                  onClick={() => onStartPlan(plan)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> 开练
                </button>
              </div>

              {/* 动作清单 */}
              <div className="mt-3.5 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 block mb-2">动作编排 ({plan.exercises.length}个):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {plan.exercises.map((pe, idx) => {
                    const ex = allExercises.find(e => e.id === pe.exerciseId);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                          <span className="font-semibold text-slate-800 truncate">{ex?.name || '未知动作'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 font-medium ml-2">
                          {pe.targetSets}组 × {pe.targetReps || 12}次
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 卡片底栏操作按钮 */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">有氧: {plan.cardioMinutes > 0 ? `${plan.cardioType || '有氧'} ${plan.cardioMinutes}分钟` : '练后无有氧'}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(plan)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="复制为新副本"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 text-[11px] font-semibold border border-slate-200"
                  >
                    <Edit3 className="w-3 h-3" /> 编辑
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 创建 / 编辑计划模态框 */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col p-4 shadow-2xl">
            {/* 模态框顶部 */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {editingPlan.id ? '编辑训练计划' : '创建新计划'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 表单内容 */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">计划名称 (如: 胸 ➕ 三头)</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  placeholder="例如: 胸 ➕ 三头、背 ➕ 二头、腿日..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">计划简介/备注</label>
                <input
                  type="text"
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="例如: 胸部推力与夹胸结合，练后20分钟快走"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* 有氧设置 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-pink-600" /> 练后附加有氧设置
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 15, 20, 30].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setEditingPlan({ ...editingPlan, cardioMinutes: mins })}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                          editingPlan.cardioMinutes === mins
                            ? 'bg-pink-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {mins === 0 ? '无有氧(腿日)' : `${mins}分钟`}
                      </button>
                    ))}
                  </div>
                </div>

                {editingPlan.cardioMinutes > 0 && (
                  <input
                    type="text"
                    value={editingPlan.cardioType || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, cardioType: e.target.value })}
                    placeholder="有氧项目: 跑步机坡度快走 / 爬楼机 / 椭圆机"
                    className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                  />
                )}
              </div>

              {/* 动作列表编辑与拖拽/上下调换 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    计划动作序列 ({editingPlan.exercises.length}个)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsSelectExOpen(true)}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> 从动作库添加
                  </button>
                </div>

                {editingPlan.exercises.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs bg-slate-50">
                    还没有添加动作，点击上方“从动作库添加”挑选动作
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingPlan.exercises.map((pe, idx) => {
                      const ex = allExercises.find(e => e.id === pe.exerciseId);
                      return (
                        <div
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-400 font-mono text-xs w-4">{idx + 1}.</span>
                            <div>
                              <div className="font-bold text-slate-900 text-xs truncate">{ex?.name || '未知动作'}</div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                <span>
                                  目标组:
                                  <input
                                    type="number"
                                    value={pe.targetSets}
                                    onChange={(e) => {
                                      const newExs = [...editingPlan.exercises];
                                      newExs[idx].targetSets = parseInt(e.target.value) || 1;
                                      setEditingPlan({ ...editingPlan, exercises: newExs });
                                    }}
                                    className="w-10 ml-1 bg-white border border-slate-200 rounded px-1 py-0.5 text-center text-slate-900"
                                  />
                                </span>
                                <span>
                                  目标次:
                                  <input
                                    type="number"
                                    value={pe.targetReps || 12}
                                    onChange={(e) => {
                                      const newExs = [...editingPlan.exercises];
                                      newExs[idx].targetReps = parseInt(e.target.value) || 1;
                                      setEditingPlan({ ...editingPlan, exercises: newExs });
                                    }}
                                    className="w-10 ml-1 bg-white border border-slate-200 rounded px-1 py-0.5 text-center text-slate-900"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 bg-white text-slate-500 hover:text-slate-800 border border-slate-200 disabled:opacity-30 rounded"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, 'down')}
                              disabled={idx === editingPlan.exercises.length - 1}
                              className="p-1 bg-white text-slate-500 hover:text-slate-800 border border-slate-200 disabled:opacity-30 rounded"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExerciseFromPlan(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 模态框底部按钮 */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
              >
                保存计划
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 选择动作加入计划模态框 */}
      {isSelectExOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">挑选动作加入计划</h3>
              <button
                onClick={() => setIsSelectExOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2.5">
              <input
                type="text"
                placeholder="搜索动作名称..."
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allExercises
                .filter(e => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                .map(e => {
                  const cat = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.chest;
                  return (
                    <div
                      key={e.id}
                      onClick={() => handleAddExerciseToPlan(e)}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs group-hover:text-blue-600">{e.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cat.bg} ${cat.color}`}>{cat.label}</span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-blue-600" />
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
