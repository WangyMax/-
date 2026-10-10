import { useState, useEffect } from 'react';
import { 
  Dumbbell, CalendarCheck, BookOpen, Scale 
} from 'lucide-react';
import { WorkoutPlan, Exercise } from './types';
import { StorageService } from './utils/storage';
import { buildSessionFromPlan } from './utils/sessionBuilder';
import { WorkoutView } from './components/WorkoutView';
import { PlansView } from './components/PlansView';
import { ExerciseLibraryView } from './components/ExerciseLibraryView';
import { WeightJournalView } from './components/WeightJournalView';

export function App() {
  const [activeTab, setActiveTab] = useState<'workout' | 'plans' | 'library' | 'journal'>('workout');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    setAllExercises(StorageService.getExercises());
  }, []);

  const refreshExercises = () => {
    setAllExercises(StorageService.getExercises());
  };

  // 从计划列表点击“开练”：切换到训练 Tab 并启动。
  // 统一走 sessionBuilder：旧内联构造缺少 isDropSet/dropStages 处理，
  // 从计划页开练超级组计划会丢阶梯数据；同时移除 window.location.hash 重绘 hack
  //（Tab 条件渲染本就保证 WorkoutView 重挂载并重读 activeSession，hash 只污染返回键历史）。
  const handleStartPlanFromPlansTab = (plan: WorkoutPlan) => {
    StorageService.saveActiveSession(buildSessionFromPlan(plan, allExercises));
    setActiveTab('workout');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 顶部系统状态栏安全避让垫片，彻底解决手机顶部时间/电量图标重叠问题 */}
      <div className="h-[max(env(safe-area-inset-top),38px)] w-full shrink-0 bg-slate-50" />
      {/* 移动端视口容器 (限制在手机尺寸优雅居中，桌面端自适应居中) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-1 pb-8">
        {activeTab === 'workout' && (
          <WorkoutView
            onOpenPlansTab={() => setActiveTab('plans')}
            allExercises={allExercises}
          />
        )}

        {activeTab === 'plans' && (
          <PlansView
            allExercises={allExercises}
            onStartPlan={handleStartPlanFromPlansTab}
          />
        )}

        {activeTab === 'library' && (
          <ExerciseLibraryView
            exercises={allExercises}
            onRefreshExercises={refreshExercises}
          />
        )}

        {activeTab === 'journal' && (
          <WeightJournalView />
        )}
      </main>

      {/* 底部导航栏 (现代原生风格磨砂玻璃 Tab Bar) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-2xl border-t border-slate-200/80 shadow-[0_-4px_24px_rgba(15,23,42,0.05)] safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-3 items-center">
          {[
            { id: 'workout', label: '今日训练', icon: Dumbbell },
            { id: 'plans', label: '计划分化', icon: CalendarCheck },
            { id: 'library', label: '动作库', icon: BookOpen },
            { id: 'journal', label: '日志记录', icon: Scale },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'workout' | 'plans' | 'library' | 'journal')}
                className={`flex flex-col items-center justify-center gap-1 transition-all py-1.5 rounded-2xl select-none active:scale-95 ${
                  isActive
                    ? 'text-blue-700 font-black bg-blue-50/70 ring-1 ring-blue-500/10'
                    : 'text-slate-400 hover:text-slate-700 font-semibold'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                <span className="text-[11px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
