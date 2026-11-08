import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Dumbbell, CalendarCheck, BookOpen, Scale, Pill
} from 'lucide-react';
import { WorkoutPlan, Exercise } from './types';
import { StorageService } from './utils/storage';
import { buildSessionFromPlan } from './utils/sessionBuilder';
import { useMedication } from './utils/useMedication';
import { formatSlotLabel, intervalLabel } from './utils/medication';
import { WorkoutView } from './components/WorkoutView';
import { PlansView } from './components/PlansView';
import { ExerciseLibraryView } from './components/ExerciseLibraryView';
import { WeightJournalView } from './components/WeightJournalView';
import { MedicationView } from './components/MedicationView';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

type TabId = 'workout' | 'plans' | 'library' | 'journal' | 'medication';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workout');
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  // 专注模式：训练进行中时隐藏底部导航，防组间误触
  const [inFocusMode, setInFocusMode] = useState(false);
  // 用药状态提升到 App：用药页、底部导航红点、到点弹层共用同一份快照
  const med = useMedication();

  useEffect(() => {
    setAllExercises(StorageService.getExercises());
  }, []);

  const refreshExercises = () => {
    setAllExercises(StorageService.getExercises());
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  // 点击系统通知 → 直接落到「用药」页并清掉这条通知（默认只会打开上次所在的 Tab）
  useEffect(() => {
    let remove: (() => void) | undefined;
    void (async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const handle = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          action => {
            const slot = (action.notification.extra as { medicationSlot?: string } | undefined)
              ?.medicationSlot;
            if (!slot) return;
            setActiveTab('medication');
            void LocalNotifications.cancel({
              notifications: [{ id: action.notification.id }],
            }).catch(() => undefined);
          },
        );
        remove = () => {
          void handle.remove();
        };
      } catch {
        // 插件缺失 / 非原生环境：忽略，不影响其余功能
      }
    })();
    return () => remove?.();
  }, []);

  // 从计划列表点击“开练”：切换到训练 Tab 并启动。
  // 统一走 sessionBuilder：旧内联构造缺少 isDropSet/dropStages 处理，
  // 从计划页开练超级组计划会丢阶梯数据；同时移除 window.location.hash 重绘 hack
  //（Tab 条件渲染本就保证 WorkoutView 重挂载并重读 activeSession，hash 只污染返回键历史）。
  const handleStartPlanFromPlansTab = (plan: WorkoutPlan) => {
    StorageService.saveActiveSession(buildSessionFromPlan(plan, allExercises));
    setActiveTab('workout');
  };

  // 到点提醒弹层：开关打开 + 有待处理槽位 + 不在"稍后提醒"窗口内 + 不在用药页（页内已有主操作）
  const showMedReminder =
    med.config.reminderEnabled &&
    med.state.isDue &&
    med.now >= med.snoozeUntil &&
    !inFocusMode &&
    activeTab !== 'medication';

  // 底部导航回到 4 项：用药下沉到「计划分化」页入口，第 4 项直接叫「每天记录体重」
  const navTabs: Array<{ id: TabId; label: string; icon: typeof Dumbbell }> = [
    { id: 'workout', label: '今日训练', icon: Dumbbell },
    { id: 'plans', label: '计划分化', icon: CalendarCheck },
    { id: 'library', label: '动作库', icon: BookOpen },
    { id: 'journal', label: '每天记录体重', icon: Scale },
  ];

  // 用药页是「计划分化」下的二级页，导航高亮跟随父级
  const navActiveId: TabId = activeTab === 'medication' ? 'plans' : activeTab;

  // 计划分化页里的用药入口摘要：到点优先提示，否则显示周期与下一次
  const medSummary = med.state.isDue
    ? `${med.config.dosage || '剂量未填写'} · ${med.config.reminderTime} 已到点，记得打卡`
    : `${intervalLabel(med.config)} · ${med.config.reminderTime} · 下次 ${
        med.state.upcoming[0] ? formatSlotLabel(med.state.upcoming[0].date) : '—'
      }`;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* 状态栏避让由 MainActivity 原生 insets 统一处理（含打孔/刘海与手势条），此处不再叠加 CSS 垫片，避免双倍留白 */}
      {/* 移动端视口容器 (限制在手机尺寸优雅居中，桌面端自适应居中) */}
      <main key={activeTab} className="page-view flex-1 w-full max-w-md mx-auto px-4 pt-1 pb-8">
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
            onRefreshExercises={refreshExercises}
            medication={{
              due: med.state.isDue,
              summary: medSummary,
              onOpen: () => setActiveTab('medication'),
            }}
          />
        )}

        {activeTab === 'library' && (
          <ExerciseLibraryView
            exercises={allExercises}
            onRefreshExercises={refreshExercises}
          />
        )}

        {activeTab === 'journal' && (
          <WeightJournalView
            allExercises={allExercises}
            initialSubTab="weight"
            onRefreshExercises={refreshExercises}
            onDataChanged={refreshExercises}
          />
        )}

        {activeTab === 'medication' && (
          <MedicationView med={med} onBack={() => setActiveTab('plans')} />
        )}
      </main>

      {/* 底部导航栏：白底磨砂、1px 顶线、选中项用 4px 强调色圆点；专注模式下隐藏 */}
      {!inFocusMode && (
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-line bg-surface/95 backdrop-blur-2xl shadow-[0_-4px_24px_rgba(16,24,40,0.04)] safe-bottom">
          <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-2 items-center">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = navActiveId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-ctl transition-colors duration-150 select-none active:scale-95 ${
                    isActive ? 'text-ink font-semibold' : 'text-ink-3 font-medium'
                  }`}
                >
                  <span className="relative">
                    <Icon className={`h-[22px] w-[22px] transition-transform ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'}`} />

                  </span>
                  <span className="text-cap tracking-tight">{tab.label}</span>
                  <span aria-hidden="true" className={`h-1 w-1 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* 到点提醒：App 在前台时用 App 内弹层（原生通知负责后台/冷启动） */}
      <Sheet
        open={showMedReminder}
        onClose={() => med.snooze(60 * 60 * 1000)}
        title={`该服用${med.config.name}了`}
        description={`${med.config.dosage || '剂量未填写'} · ${intervalLabel(med.config)} · 应服时间 ${med.config.reminderTime}`}
        footer={
          <div className="space-y-2">
            <Button variant="primary" size="lg" block onClick={() => med.markTaken()}>
              <Pill className="h-4 w-4" />
              一键标记已服用
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => med.snooze(2 * 60 * 60 * 1000)}>
                稍后提醒（2 小时）
              </Button>
              <Button variant="ghost" onClick={() => med.skipSlot()}>
                本次跳过
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-2 text-sm2 leading-relaxed text-ink-2">
          <p>
            {med.state.dueSlot && med.state.dueSlot.date < med.state.today
              ? `应服日是 ${med.state.dueSlot.date}，已经逾期。补记会按补记当天的时间存档，并标记为「逾期补记」。`
              : '到点提醒已开启：服用后点一下记录，每次是否按时都能在「用药」页回看。'}
          </p>
          <p className="text-ink-3">
            关闭弹层 = 稍后 1 小时再提醒；真正停用提醒请到「用药」页关掉开关。
          </p>
        </div>
      </Sheet>
    </div>
  );
}

export default App;
