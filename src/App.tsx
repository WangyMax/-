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
  // 专注模式：训练进行中时隐藏底部导航，防组间误触
  const [inFocusMode, setInFocusMode] = useState(false);

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
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* 状态栏避让由 MainActivity 原生 insets 统一处理（含打孔/刘海与手势条），此处不再叠加 CSS 垫片，避免双倍留白 */}
      {/* 移动端视口容器 (限制在手机尺寸优雅居中，桌面端自适应居中) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-1 pb-8">
        {activeTab === 'workout' && (
          <WorkoutView
            onOpenPlansTab={() => setActiveTab('plans')}
            allExercises={allExercises}
            onFocusModeChange={setInFocusMode}
            onRefreshExercises={refreshExercises}
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
          <WeightJournalView allExercises={allExercises} />
        )}
      </main>

      {/* 底部导航栏：白底磨砂、1px 顶线、选中项用 4px 强调色圆点；专注模式下隐藏 */}
      {!inFocusMode && (
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-surface/95 backdrop-blur-2xl shadow-[0_-4px_24px_rgba(16,24,40,0.04)] safe-bottom">
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
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'workout' | 'plans' | 'library' | 'journal')}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-ctl transition-colors duration-150 select-none active:scale-95 ${
                    isActive ? 'text-ink font-semibold' : 'text-ink-3 font-medium'
                  }`}
                >
                  <Icon className={`h-[22px] w-[22px] transition-transform ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                  <span className="text-cap tracking-tight">{tab.label}</span>
                  <span aria-hidden="true" className={`h-1 w-1 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
