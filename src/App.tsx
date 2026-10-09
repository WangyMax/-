import { useState, useEffect } from 'react';
import { 
  Dumbbell, CalendarCheck, BookOpen, Scale 
} from 'lucide-react';
import { WorkoutPlan, Exercise } from './types';
import { StorageService } from './utils/storage';
import { WorkoutView } from './components/WorkoutView';
import { PlansView } from './components/PlansView';
import { ExerciseLibraryView } from './components/ExerciseLibraryView';
import { WeightJournalView } from './components/WeightJournalView';
import { FluidCapsule } from './components/FluidCapsule';

export function App() {
  const [activeTab, setActiveTab] = useState<'workout' | 'plans' | 'library' | 'journal'>('workout');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    setAllExercises(StorageService.getExercises());
  }, []);

  const refreshExercises = () => {
    setAllExercises(StorageService.getExercises());
  };

  // 从计划列表点击“开练”：切换到训练 Tab 并启动
  const handleStartPlanFromPlansTab = (plan: WorkoutPlan) => {
    // 构造或更新当前进行中训练
    const exerciseLogs = plan.exercises.map(pe => {
      const exDetail = allExercises.find(e => e.id === pe.exerciseId);
      const lastLog = StorageService.getLastExerciseLog(pe.exerciseId);
      const unit = exDetail?.defaultUnit || 'plates';
      const pulley = exDetail?.defaultPulley || 'none';

      const sets = Array.from({ length: pe.targetSets || 4 }, (_, i) => {
        const lastSet = lastLog?.sets[i];
        return {
          id: `s-${Date.now()}-${i}`,
          setNumber: i + 1,
          unit: lastSet?.unit || unit,
          weightOrPlates: lastSet?.weightOrPlates || (unit === 'plates' ? 8 : 40),
          reps: lastSet?.reps || pe.targetReps || 12,
          completed: false,
          pulleyRatio: lastSet?.pulleyRatio || pulley,
        };
      });

      return {
        exerciseId: pe.exerciseId,
        exerciseName: exDetail?.name || '未知动作',
        category: exDetail?.category || 'chest',
        pulleyRatio: pulley,
        currentUnit: unit,
        sets,
        notes: pe.notes || ''
      };
    });

    const newSession = {
      id: `sess-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      planId: plan.id,
      planName: plan.name,
      startTime: Date.now(),
      exercises: exerciseLogs,
      cardioMinutes: plan.cardioMinutes,
      cardioCompleted: plan.cardioMinutes > 0,
      cardioType: plan.cardioType || (plan.cardioMinutes > 0 ? '跑步机坡度快走' : undefined),
      cardioNotes: plan.cardioMinutes > 0 ? '坡度 10，速度 5.0 km/h 维持心率' : '',
    };

    StorageService.saveActiveSession(newSession);
    setActiveTab('workout');
    // 强制触发一次重绘
    window.location.hash = '#workout-' + Date.now();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative">
      {/* OPPO一加流体云灵动胶囊：常驻顶部打孔区中央，后台绝对时间戳保活与震动提醒 */}
      <FluidCapsule />

      {/* 顶部系统状态栏安全避让垫片，彻底解决手机顶部时间/电量图标重叠问题 */}
      <div className="h-[max(env(safe-area-inset-top),38px)] w-full shrink-0 bg-slate-50" />
      {/* 移动端视口容器 (限制在手机尺寸优雅居中，桌面端自适应居中) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-1 pb-8">
        {activeTab === 'workout' && (
          <WorkoutView
            onOpenPlansTab={() => setActiveTab('plans')}
            onOpenLibraryTab={() => setActiveTab('library')}
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

      {/* 底部导航栏 (Tab Navigation) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-lg shadow-slate-200/50 safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-2">
          <button
            onClick={() => setActiveTab('workout')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'workout'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[11px]">今日训练</span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'plans'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CalendarCheck className="w-5 h-5" />
            <span className="text-[11px]">计划分化</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'library'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px]">动作库</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'journal'
                ? 'text-blue-600 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Scale className="w-5 h-5" />
            <span className="text-[11px]">日志记录</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
