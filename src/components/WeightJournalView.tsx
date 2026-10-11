import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, Plus, TrendingDown, TrendingUp,
  Trash2, Download, Upload, CheckCircle2, MessageSquare,
  Dumbbell, Flame, RotateCcw, Check, ChevronDown, ChevronUp,
  Layers, Coffee, Target, CalendarDays, Zap
} from 'lucide-react';
import { WeightLog, WorkoutSession } from '../types';
import { StorageService } from '../utils/storage';
import { todayLocalDate, shiftLocalDate, weekdayOf } from '../utils/date';
import {
  sessionVolumes, formatVolumeShort, sessionDurationMin,
  countWeekTrainings, computeStreak, totalCompletedSetsAll,
} from '../utils/stats';
import { ConfirmSheet } from './ConfirmSheet';

interface WeightJournalViewProps {
  onDataChanged?: () => void;
}

const SLOT_SHORT: Record<string, string> = {
  'morning': '晨起',
  'evening': '晚间',
  'post-workout': '练后',
};

export const WeightJournalView: React.FC<WeightJournalViewProps> = ({
  onDataChanged,
}) => {
  // 当前子标签: 'training' | 'weight'
  const [activeSubTab, setActiveSubTab] = useState<'training' | 'weight'>('training');

  // 训练记录列表与展开状态集合
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  // 历史筛选：全部 / 训练 / 休息
  const [historyFilter, setHistoryFilter] = useState<'all' | 'training' | 'rest'>('all');
  // 活动日历选中的日期（点格子过滤）
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // 体重日志列表与输入状态
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [inputWeight, setInputWeight] = useState('63.3');
  const [inputDate, setInputDate] = useState(() => todayLocalDate());
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  // 体重目标
  const [weightGoal, setWeightGoal] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  // 时段过滤：all / morning / post-workout / evening
  const [slotFilter, setSlotFilter] = useState<string>('all');
  // 体重打卡日历选中的日期
  const [selectedWeightDate, setSelectedWeightDate] = useState<string | null>(null);

  // 体重曲线时间跨度视图: 'week' (周视图/7天) | 'month' (月视图/30天) | 'all' (全部)
  const [chartViewSpan, setChartViewSpan] = useState<'week' | 'month' | 'all'>('week');

  // 统一确认抽屉（删除/恢复操作）
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; confirmText: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', confirmText: '确认删除', onConfirm: () => {} });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const wList = StorageService.getWeightLogs();
    const sList = StorageService.getSessions();
    setWeights(wList);
    setSessions(sList);
    setWeightGoal(StorageService.getWeightGoal());
  };

  // 切换单条训练展开/折叠
  const toggleExpandSession = (sessionId: string) => {
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // 一键全部展开 / 全部收起（只针对当前过滤后的列表）
  const toggleAllSessions = (visibleIds: string[]) => {
    const allVisibleExpanded = visibleIds.every(id => expandedSessionIds.has(id));
    if (allVisibleExpanded) {
      setExpandedSessionIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setExpandedSessionIds(prev => new Set([...prev, ...visibleIds]));
    }
  };

  // 检查选中的 inputDate 是否已经打过卡
  const existingTodayLog = weights.find(w => w.date === inputDate);
  const isAlreadyLogged = Boolean(existingTodayLog) && !isEditingExisting;

  // 当日期切换时，如果有旧数据自动载入并设置状态
  useEffect(() => {
    const existing = weights.find(w => w.date === inputDate);
    if (existing) {
      setInputWeight(existing.weight.toString());
      setInputSlot(existing.timeSlot || 'morning');
      setInputNote(existing.note || '');
      setIsEditingExisting(false);
    } else {
      setIsEditingExisting(false);
    }
  }, [inputDate, weights]);

  // 提交打卡
  const [formError, setFormError] = useState<string | null>(null);
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyLogged) return;

    const val = parseFloat(inputWeight);
    if (!val || val <= 0) {
      setFormError('请输入正确的体重数字！');
      setTimeout(() => setFormError(null), 2500);
      return;
    }

    StorageService.addWeightLog({
      date: inputDate,
      weight: val,
      timeSlot: inputSlot,
      note: inputNote.trim(),
    });

    setIsEditingExisting(false);
    refreshData();
    if (onDataChanged) onDataChanged();
  };

  // 保存体重目标
  const handleSaveGoal = () => {
    const v = parseFloat(goalInput);
    if (!v || v <= 0) {
      setFormError('请输入正确的目标体重！');
      setTimeout(() => setFormError(null), 2500);
      return;
    }
    StorageService.saveWeightGoal(v);
    setWeightGoal(v);
    setShowGoalEditor(false);
    if (onDataChanged) onDataChanged();
  };

  // 唤起删除体重确认
  const promptDeleteWeight = (id: string, date: string, weightVal: number) => {
    setConfirmState({
      open: true,
      title: '删除体重记录',
      description: `确定要彻底删除 ${date} 的 ${weightVal}kg 体重打卡记录吗？删除后将不再复原。`,
      confirmText: '确认删除',
      onConfirm: () => {
        StorageService.deleteWeightLog(id);
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      },
    });
  };

  // 唤起删除训练确认
  const promptDeleteSession = (sessionId: string, planName: string, date: string) => {
    setConfirmState({
      open: true,
      title: '删除历史训练记录',
      description: `确定要彻底删除 ${date} 的 “${planName}” 训练记录吗？此操作无法撤销。`,
      confirmText: '确认删除',
      onConfirm: () => {
        StorageService.deleteSession(sessionId);
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      },
    });
  };

  // 恢复内置官方数据 (10.06 - 10.09)
  const handleRestoreOfficialData = () => {
    setConfirmState({
      open: true,
      title: '恢复 10.06 - 10.09 真实记录',
      description: '确定重置并重新载入官方 10.06 - 10.09 四日完整真实训练与体重数据吗？',
      confirmText: '确认恢复',
      onConfirm: () => {
        StorageService.restoreOfficialData();
        setConfirmState(prev => ({ ...prev, open: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
        setImportStatus('已恢复 10.06 - 10.09 官方真实记录！');
        setTimeout(() => setImportStatus(null), 3000);
      },
    });
  };

  // 导出 JSON 备份
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitcustom-backup-${todayLocalDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入 JSON 备份
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = StorageService.importBackupJson(content);
      if (success) {
        setImportStatus('备份数据恢复成功！');
        refreshData();
        if (onDataChanged) onDataChanged();
      } else {
        setImportStatus('导入失败，文件格式有误。');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  // ================= 训练历史统计 =================
  const todayStr = todayLocalDate();
  const historyStats = useMemo(() => ({
    trainings: sessions.filter(s => !s.isRestDay).length,
    rests: sessions.filter(s => s.isRestDay).length,
    weekTrainings: countWeekTrainings(sessions, todayStr),
    streak: computeStreak(sessions, todayStr),
    totalSets: totalCompletedSetsAll(sessions),
  }), [sessions, todayStr]);

  // 活动日历：近 8 周（56 天），以今天结尾
  const activityCal = useMemo(() => {
    const days: { date: string; day: number; isToday: boolean; hasTraining: boolean; hasRest: boolean }[] = [];
    const byDate = new Map<string, { t: boolean; r: boolean }>();
    for (const s of sessions) {
      const cur = byDate.get(s.date) || { t: false, r: false };
      if (s.isRestDay) cur.r = true; else cur.t = true;
      byDate.set(s.date, cur);
    }
    for (let i = 55; i >= 0; i--) {
      const date = shiftLocalDate(todayStr, -i);
      const info = byDate.get(date);
      days.push({
        date,
        day: Number(date.slice(8, 10)),
        isToday: i === 0,
        hasTraining: Boolean(info?.t),
        hasRest: Boolean(info?.r),
      });
    }
    return days;
  }, [sessions, todayStr]);

  // 过滤后的历史列表（类型筛选 + 日历日期筛选）
  const visibleSessions = useMemo(() => {
    return sessions.filter(s => {
      if (historyFilter === 'training' && s.isRestDay) return false;
      if (historyFilter === 'rest' && !s.isRestDay) return false;
      if (selectedCalDate && s.date !== selectedCalDate) return false;
      return true;
    });
  }, [sessions, historyFilter, selectedCalDate]);

  // ================= 体重统计与洞察 =================
  const latestWeight = weights[0]?.weight;
  const previousWeight = weights[1]?.weight;
  const weightDiff = latestWeight && previousWeight ? (latestWeight - previousWeight).toFixed(1) : null;

  // 距目标还差
  const goalDiff = useMemo(() => {
    if (weightGoal === null || latestWeight === undefined) return null;
    return Math.round((latestWeight - weightGoal) * 10) / 10;
  }, [weightGoal, latestWeight]);

  // 趋势洞察：近 7 天均值 vs 再前 7 天均值
  const trendInsight = useMemo(() => {
    if (weights.length < 2) return null;
    const sorted = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastTs = new Date(sorted[sorted.length - 1].date).getTime();
    const day = 86400000;
    const recent = sorted.filter(w => new Date(w.date).getTime() > lastTs - 7 * day);
    const prev = sorted.filter(w => {
      const t = new Date(w.date).getTime();
      return t <= lastTs - 7 * day && t > lastTs - 14 * day;
    });
    if (recent.length === 0 || prev.length === 0) return null;
    const avg = (arr: WeightLog[]) => arr.reduce((a, b) => a + b.weight, 0) / arr.length;
    const delta = Math.round((avg(recent) - avg(prev)) * 10) / 10;
    if (delta < -0.05) return { text: `稳步下降中，近7天均值比之前一周低 ${Math.abs(delta)}kg，继续保持`, good: true };
    if (delta > 0.05) return { text: `近7天均值比之前一周高 ${delta}kg，注意饮食与训练量`, good: false };
    return { text: '体重保持平稳，波动在正常范围内', good: true };
  }, [weights]);

  // 体重打卡日历：近 6 周（42 天）
  const weightCal = useMemo(() => {
    const days: { date: string; day: number; isToday: boolean; logged: boolean }[] = [];
    const dateSet = new Set(weights.map(w => w.date));
    for (let i = 41; i >= 0; i--) {
      const date = shiftLocalDate(todayStr, -i);
      days.push({
        date,
        day: Number(date.slice(8, 10)),
        isToday: i === 0,
        logged: dateSet.has(date),
      });
    }
    return days;
  }, [weights, todayStr]);

  // 时段过滤 + 打卡日历日期过滤后的体重列表
  const visibleWeights = useMemo(() => {
    return weights.filter(w => {
      if (slotFilter !== 'all' && (w.timeSlot || 'morning') !== slotFilter) return false;
      if (selectedWeightDate && w.date !== selectedWeightDate) return false;
      return true;
    });
  }, [weights, slotFilter, selectedWeightDate]);

  // 根据当前视图筛选体重数据并按日期升序排列供画曲线
  const filteredChartWeights = useMemo(() => {
    if (weights.length === 0) return [];
    const sorted = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (chartViewSpan === 'all') {
      return sorted;
    }

    // 周视图取近 7 天，月视图取近 30 天
    const daysLimit = chartViewSpan === 'week' ? 7 : 30;
    // 取最新记录的日期作为基准时间（防止历史预置日期距今天数过大导致过滤为空）
    const latestTimestamp = new Date(sorted[sorted.length - 1].date).getTime();
    const cutoffTime = latestTimestamp - (daysLimit - 1) * 24 * 60 * 60 * 1000;

    const inRange = sorted.filter(w => new Date(w.date).getTime() >= cutoffTime);
    if (inRange.length > 0) return inRange;
    return sorted.slice(-daysLimit);
  }, [weights, chartViewSpan]);

  // 计算区间曲线的统计指标（最高、最低、均值、波动差值）
  const chartStats = useMemo(() => {
    if (filteredChartWeights.length === 0) return null;
    const vals = filteredChartWeights.map(w => w.weight);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    const netChange = (vals[vals.length - 1] - vals[0]).toFixed(1);
    return { min, max, avg, netChange: parseFloat(netChange) };
  }, [filteredChartWeights]);

  // 生成高保真 SVG 平滑贝塞尔曲线路径（含目标体重虚线）
  const svgData = useMemo(() => {
    const list = filteredChartWeights;
    const width = 360;
    const height = 150;
    const padL = 36;
    const padR = 24;
    const padT = 24;
    const padB = 26;

    if (list.length === 0) return null;

    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const vals = list.map(d => d.weight);
    let minVal = Math.min(...vals);
    let maxVal = Math.max(...vals);
    // 目标线纳入纵轴范围
    if (weightGoal !== null) {
      minVal = Math.min(minVal, weightGoal);
      maxVal = Math.max(maxVal, weightGoal);
    }
    if (maxVal === minVal) {
      minVal -= 1;
      maxVal += 1;
    } else {
      const margin = (maxVal - minVal) * 0.18;
      minVal -= margin;
      maxVal += margin;
    }
    const yOf = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    const points = list.map((item, idx) => {
      let x: number;
      if (list.length === 1) {
        x = padL + chartW / 2;
      } else if (chartViewSpan === 'month') {
        const startOffset = padL + chartW * 0.2;
        const availableW = chartW * 0.75;
        x = startOffset + (idx / (list.length - 1)) * availableW;
      } else {
        x = padL + (idx / (list.length - 1)) * chartW;
      }
      return { x, y: yOf(item.weight), weight: item.weight, date: item.date.slice(5) };
    });

    const goalY = weightGoal !== null ? yOf(weightGoal) : null;

    if (points.length === 1) {
      const p = points[0];
      return {
        width, height, points, goalY,
        linePath: `M ${padL} ${p.y} L ${width - padR} ${p.y}`,
        areaPath: `M ${padL} ${p.y} L ${width - padR} ${p.y} L ${width - padR} ${height - padB} L ${padL} ${height - padB} Z`,
        midVal: ((minVal + maxVal) / 2).toFixed(1),
        minVal: minVal.toFixed(1),
        maxVal: maxVal.toFixed(1),
      };
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = (p1.x - p0.x) * (chartViewSpan === 'month' ? 0.35 : 0.45);
      const cp1x = p0.x + dx;
      const cp1y = p0.y;
      const cp2x = p1.x - dx;
      const cp2y = p1.y;
      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    const lastP = points[points.length - 1];
    const firstP = points[0];
    const areaPath = `${linePath} L ${lastP.x} ${height - padB} L ${firstP.x} ${height - padB} Z`;

    return {
      width, height, points, goalY,
      linePath, areaPath,
      midVal: ((minVal + maxVal) / 2).toFixed(1),
      minVal: minVal.toFixed(1),
      maxVal: maxVal.toFixed(1),
    };
  }, [filteredChartWeights, chartViewSpan, weightGoal]);

  // 日历格子渲染（训练活动）
  const renderActivityCal = () => (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-black text-slate-900 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> 近8周活动
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />训练</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />休息</span>
          {selectedCalDate && (
            <button
              type="button"
              onClick={() => setSelectedCalDate(null)}
              className="text-blue-600 font-bold underline"
            >
              清除{selectedCalDate.slice(5)}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-[10px] text-slate-300 font-bold">{w}</div>
        ))}
        {/* 首格按星期补齐 */}
        {Array.from({ length: weekdayOf(activityCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {activityCal.map(d => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedCalDate(prev => (prev === d.date ? null : d.date))}
            className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all active:scale-95 ${
              selectedCalDate === d.date
                ? 'ring-2 ring-blue-600 ring-offset-1'
                : ''
            } ${
              d.hasTraining
                ? 'bg-blue-500 text-white'
                : d.hasRest
                  ? 'bg-amber-300 text-amber-900'
                  : d.isToday
                    ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                    : 'bg-slate-100 text-slate-300'
            }`}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );

  // 体重打卡日历
  const renderWeightCal = () => (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-black text-slate-900 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5 text-emerald-600" /> 近6周打卡
        </span>
        {selectedWeightDate && (
          <button
            type="button"
            onClick={() => setSelectedWeightDate(null)}
            className="text-[11px] text-emerald-600 font-bold underline"
          >
            清除{selectedWeightDate.slice(5)}
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={i} className="text-center text-[10px] text-slate-300 font-bold">{w}</div>
        ))}
        {Array.from({ length: weekdayOf(weightCal[0]?.date || todayStr) }).map((_, i) => (
          <div key={`wpad-${i}`} />
        ))}
        {weightCal.map(d => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelectedWeightDate(prev => (prev === d.date ? null : d.date))}
            className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all active:scale-95 ${
              selectedWeightDate === d.date ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
            } ${
              d.logged
                ? 'bg-emerald-500 text-white'
                : d.isToday
                  ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                  : 'bg-slate-100 text-slate-300'
            }`}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pb-24 pt-2 space-y-4">
      {/* 头部标题与双标签切换 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">训练与生活日志</h1>
        <p className="text-xs text-slate-500 mt-0.5">历史打卡归档、日常体重走势与身体状态记录</p>
      </div>

      {/* 顶部子标签分段控制器 */}
      <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner">
        <button
          onClick={() => setActiveSubTab('training')}
          className={`flex-1 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] ${
            activeSubTab === 'training'
              ? 'bg-white text-blue-700 font-black shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/50'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5" /> 历史训练记录 ({sessions.length}次)
        </button>

        <button
          onClick={() => setActiveSubTab('weight')}
          className={`flex-1 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.98] ${
            activeSubTab === 'weight'
              ? 'bg-white text-emerald-700 font-black shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900 font-bold hover:bg-white/50'
          }`}
        >
          <Scale className="w-3.5 h-3.5" /> 体重与生活日志 ({weights.length}条)
        </button>
      </div>

      {/* 提示消息浮层 */}
      {importStatus && (
        <div className="p-2.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* ===================== TAB 1: 历史训练记录 ===================== */}
      {activeSubTab === 'training' && (
        <div className="space-y-3">
          {/* 统计条 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '累计训练', value: `${historyStats.trainings}次`, accent: 'text-blue-700' },
              { label: '本周训练', value: `${historyStats.weekTrainings}次`, accent: 'text-blue-700' },
              { label: '连续打卡', value: `${historyStats.streak}天`, accent: 'text-amber-600' },
              { label: '总完成组', value: `${historyStats.totalSets}组`, accent: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-slate-200/90 rounded-2xl p-2 text-center shadow-sm min-w-0">
                <span className="text-[10px] text-slate-400 block truncate">{s.label}</span>
                <span className={`text-xs font-black font-mono ${s.accent}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {renderActivityCal()}

          {/* 筛选 + 展开控制 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/60 text-[11px] font-bold">
              {([
                { key: 'all', label: '全部' },
                { key: 'training', label: '训练' },
                { key: 'rest', label: '休息' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryFilter(f.key)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    historyFilter === f.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {visibleSessions.length > 0 && (
              <button
                onClick={() => toggleAllSessions(visibleSessions.map(s => s.id))}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
              >
                <Layers className="w-3 h-3" />
                {visibleSessions.every(s => expandedSessionIds.has(s.id)) ? '全部收起' : '全部展开'}
              </button>
            )}
          </div>

          {visibleSessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
              {sessions.length === 0
                ? '暂无历史训练记录，去“今日训练”开启第一次打卡吧！'
                : '当前筛选下没有记录，换个条件试试'}
            </div>
          ) : (
            visibleSessions.map((sess) => {
              // 专属渲染：纯粹的完全休息日卡片
              if (sess.isRestDay) {
                return (
                  <div
                    key={sess.id}
                    className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-amber-950 text-sm">休息日 (完全休息)</span>
                        <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-200">
                          {sess.date}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => promptDeleteSession(sess.id, sess.planName, sess.date)}
                      className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-amber-100/50 transition-colors"
                      title="删除此条记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              const isExpanded = expandedSessionIds.has(sess.id);
              const totalCompletedSets = sess.exercises.reduce(
                (sum, e) => sum + e.sets.filter(s => s.completed).length, 0
              );
              const vols = sessionVolumes(sess);
              const volStr = formatVolumeShort(vols.kg, vols.plates);
              const durMin = sessionDurationMin(sess);

              return (
                <div
                  key={sess.id}
                  className="bg-white border border-slate-200/90 rounded-2xl shadow-sm transition-all overflow-hidden"
                >
                  {/* 可点击卡片头部（触发折叠/展开） */}
                  <div
                    onClick={() => toggleExpandSession(sess.id)}
                    className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-slate-900 text-sm">{sess.planName}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {sess.date}
                        </span>
                        {sess.cardioCompleted && (
                          <span className="text-[10px] text-pink-700 bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200 flex items-center gap-0.5 font-bold">
                            <Flame className="w-2.5 h-2.5" /> 有氧{sess.cardioMinutes || 20}m
                          </span>
                        )}
                        {!sess.cardioCompleted && sess.cardioMinutes === 0 && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200">
                            腿日无有氧
                          </span>
                        )}
                      </div>

                      {/* 折叠态摘要：容量 + 时长 + 动作列表 */}
                      <p className="text-[11px] text-slate-500 truncate">
                        共 {sess.exercises.length} 个动作 · {totalCompletedSets} 组完成
                        {volStr && <> · <span className="font-bold text-slate-700">容量 {volStr}</span></>}
                        {durMin !== null && <> · 用时 {durMin}分钟</>}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {sess.exercises.map(e => e.exerciseName).join('、')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          promptDeleteSession(sess.id, sess.planName, sess.date);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="删除该条训练记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50/80 px-2 py-1 rounded-lg border border-blue-200/80">
                        <span>{isExpanded ? '收起' : '展开'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* 展开内容区：具体动作与每组明细 */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 bg-slate-50/40 space-y-2.5">
                      <div className="space-y-2 pt-2">
                        {sess.exercises.map((e, idx) => {
                          const completedSets = e.sets.filter(s => s.completed);
                          const unitStr = e.currentUnit === 'plates' ? '片' : e.currentUnit === 'assisted' ? '助力' : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                          const pulleyStr = e.pulleyRatio && e.pulleyRatio !== 'none' ? ` (${e.pulleyRatio})` : '';

                          return (
                            <div key={idx} className="bg-white rounded-xl p-2.5 border border-slate-200/80 text-xs shadow-2xs">
                              <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                                  <span className="text-slate-900">{e.exerciseName}</span>
                                  {pulleyStr && (
                                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200 font-normal">
                                      {e.pulleyRatio}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-blue-700 font-semibold font-mono">
                                  {completedSets.length} 组完成
                                </span>
                              </div>

                              {/* 各组小标签 / 超级组大组阶梯流 */}
                              <div className="flex flex-wrap gap-1.5">
                                {completedSets.map((s, sIdx) => {
                                  if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
                                    return (
                                      <div
                                        key={sIdx}
                                        className="w-full bg-slate-50/90 p-2 rounded-xl border border-slate-200/90 text-[11px] font-mono space-y-1.5"
                                      >
                                        <div className="font-bold text-slate-800 flex items-center justify-between">
                                          <span className="text-blue-700 font-sans font-black">第 {s.setNumber} 大组 (递减超级组)</span>
                                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-sans font-semibold">
                                            {s.dropStages.length}阶递减全部完成
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-slate-800">
                                          {s.dropStages.map((stg, stgIdx) => (
                                            <span key={stgIdx} className="bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 font-bold shadow-2xs">
                                              {stg.weightOrPlates}{stg.unit || 'kg'} × {stg.reps}次
                                              {stgIdx < s.dropStages!.length - 1 && <span className="text-slate-300 ml-1">➔</span>}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <span
                                      key={sIdx}
                                      className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 font-medium"
                                    >
                                      {s.weightOrPlates}{unitStr} × {s.reps}次
                                    </span>
                                  );
                                })}
                              </div>

                              {e.notes && (
                                <p className="mt-1.5 text-[10px] text-slate-400 italic">“{e.notes}”</p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 训练备注 */}
                      {sess.notes && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-1.5 text-xs text-blue-900">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>{sess.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================== TAB 2: 体重与生活日志 ===================== */}
      {activeSubTab === 'weight' && (
        <div className="space-y-4">
          {/* 趋势洞察横幅 */}
          {trendInsight && (
            <div className={`p-2.5 text-xs border rounded-xl flex items-center gap-2 ${
              trendInsight.good
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <Zap className="w-4 h-4 shrink-0" />
              <span className="font-bold">趋势洞察：{trendInsight.text}</span>
            </div>
          )}

          {/* 打卡今日体重与饮食卡片 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">打卡今日体重与饮食</h3>
              </div>
              {existingTodayLog && !isEditingExisting && (
                <button
                  type="button"
                  onClick={() => setIsEditingExisting(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline"
                >
                  修改该日打卡
                </button>
              )}
            </div>

            {formError && (
              <p className="mb-2.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                {formError}
              </p>
            )}

            <form onSubmit={handleAddLog} className="space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <label className="text-[11px] text-slate-500 block mb-1">体重 (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={inputWeight}
                      disabled={isAlreadyLogged}
                      onChange={(e) => setInputWeight(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-base font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 ${
                        isAlreadyLogged ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                  </div>
                </div>

                <div className="col-span-7">
                  <label className="text-[11px] text-slate-500 block mb-1">记录时段</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { key: 'morning', label: '晨起空腹' },
                      { key: 'post-workout', label: '练后即刻' },
                      { key: 'evening', label: '晚间睡前' },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={isAlreadyLogged}
                        onClick={() => setInputSlot(s.key as 'morning' | 'evening' | 'post-workout')}
                        className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                          inputSlot === s.key
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : isAlreadyLogged
                            ? 'bg-slate-100 text-slate-300 border border-slate-200'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">饮食与生活日记 (饮食摄入、精神状态等)</label>
                <input
                  type="text"
                  value={inputNote}
                  disabled={isAlreadyLogged}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="例如: 晚上吃了鸡公煲，蛋白质充足；昨晚深蹲膝盖微酸..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 ${
                    isAlreadyLogged ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-50 border-slate-200 focus:bg-white'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium"
                />

                {isAlreadyLogged ? (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold cursor-not-allowed flex items-center gap-1.5 transition-all"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> 今日已打卡
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> 记录打卡
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 体重看板：最新 / 变化 / 目标 */}
          {latestWeight && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">当前最新</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">{latestWeight}</span>
                  <span className="text-xs text-slate-400">kg</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">较上一次</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {weightDiff && parseFloat(weightDiff) > 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <span className="text-base font-bold text-amber-600">+{weightDiff}</span>
                    </>
                  ) : weightDiff && parseFloat(weightDiff) < 0 ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span className="text-base font-bold text-emerald-600">{weightDiff}</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">持平</span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Target className="w-3 h-3 text-blue-600" /> 目标体重
                </span>
                {weightGoal !== null ? (
                  <div className="mt-1">
                    <span className="text-2xl font-black text-blue-700 font-mono">{weightGoal}</span>
                    <span className="text-xs text-slate-400">kg</span>
                    {goalDiff !== null && (
                      <div className={`text-[10px] font-bold mt-0.5 ${goalDiff > 0 ? 'text-amber-600' : goalDiff < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {goalDiff > 0 ? `还差 ${goalDiff}kg` : goalDiff < 0 ? `已超目标 ${Math.abs(goalDiff)}kg 🎉` : '已达标 🎉'}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setGoalInput(''); setShowGoalEditor(true); }}
                    className="mt-1.5 text-xs text-blue-600 font-bold underline"
                  >
                    设定目标
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 目标编辑行（竖排：输入一行 + 按钮一行，杜绝小屏横向溢出） */}
          {showGoalEditor && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 space-y-2 animate-card-in">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder={weightGoal !== null ? `当前 ${weightGoal}` : '例如 65'}
                  className="flex-1 min-w-0 bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 shrink-0">kg</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalEditor(false)}
                  className="py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95"
                >
                  保存目标
                </button>
              </div>
            </div>
          )}
          {weightGoal !== null && !showGoalEditor && (
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => { setGoalInput(String(weightGoal)); setShowGoalEditor(true); }}
                className="text-[11px] text-slate-400 hover:text-blue-600 underline"
              >
                修改目标
              </button>
            </div>
          )}

          {/* 体重波动曲线图 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
            {/* 顶栏：标题与视图切换按钮 */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> 体重波动曲线
                </span>
                <span className="text-[10px] text-slate-400">平滑贝塞尔走势{weightGoal !== null ? ' · 蓝色虚线为目标' : ''}</span>
              </div>

              {/* 周期切换: 周视图 / 月视图 / 全部 */}
              <div className="bg-slate-200/80 p-0.5 rounded-xl flex items-center border border-slate-300/80 text-[11px] gap-0.5">
                <button
                  type="button"
                  onClick={() => setChartViewSpan('week')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'week'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  周
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewSpan('month')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'month'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  月
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewSpan('all')}
                  className={`px-2.5 py-1 rounded-lg font-black transition-all active:scale-95 ${
                    chartViewSpan === 'all'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  全部
                </button>
              </div>
            </div>

            {/* 动态视图说明横幅 */}
            <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center justify-between border transition-all ${
              chartViewSpan === 'week'
                ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80'
                : chartViewSpan === 'month'
                ? 'bg-blue-50/90 text-blue-800 border-blue-200/80'
                : 'bg-purple-50/90 text-purple-800 border-purple-200/80'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                <span>
                  {chartViewSpan === 'week' && '周视图：近7日走势'}
                  {chartViewSpan === 'month' && '月视图：过去30天走势'}
                  {chartViewSpan === 'all' && '全部历史：全周期累计数据'}
                </span>
              </div>
              <span className="font-mono text-[10px] opacity-80">
                {filteredChartWeights.length} 条
              </span>
            </div>

            {/* 区间统计指标指示条 */}
            {chartStats && (
              <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">最低</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">{chartStats.min}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">最高</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.max}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">平均</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.avg}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">净变</span>
                  <span className={`text-xs font-bold font-mono ${
                    chartStats.netChange > 0 ? 'text-amber-600' : chartStats.netChange < 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}>
                    {chartStats.netChange > 0 ? `+${chartStats.netChange}` : chartStats.netChange}kg
                  </span>
                </div>
              </div>
            )}

            {/* SVG 矢量平滑折线走势图 */}
            {svgData && svgData.points.length > 0 ? (
              <div className="w-full overflow-hidden pt-1">
                <svg
                  viewBox={`0 0 ${svgData.width} ${svgData.height}`}
                  className="w-full h-36 select-none"
                >
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* 背景参考横虚线 */}
                  <line x1="36" y1="30" x2="336" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="75" x2="336" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="36" y1="120" x2="336" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />

                  {/* 目标体重虚线 */}
                  {svgData.goalY !== null && weightGoal !== null && (
                    <g>
                      <line
                        x1="36" y1={svgData.goalY} x2="336" y2={svgData.goalY}
                        stroke="#3b82f6" strokeDasharray="5 4" strokeWidth="1.5"
                      />
                      <text
                        x="336" y={svgData.goalY - 5}
                        textAnchor="end" fontSize="9" fontWeight="bold" fill="#3b82f6"
                        className="font-mono"
                      >
                        目标 {weightGoal}
                      </text>
                    </g>
                  )}

                  {/* 面积渐变填充 */}
                  <path d={svgData.areaPath} fill="url(#weightGradient)" />

                  {/* 平滑贝塞尔曲线 */}
                  <path
                    d={svgData.linePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* 节点高亮圆点与文字标注 */}
                  {svgData.points.map((p, idx) => (
                    <g key={idx}>
                      <circle cx={p.x} cy={p.y} r="5" fill="#10b981" fillOpacity="0.15" />
                      <circle cx={p.x} cy={p.y} r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      <text
                        x={p.x}
                        y={p.y - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#0f172a"
                        className="font-mono"
                      >
                        {p.weight}
                      </text>
                      <text
                        x={p.x}
                        y={svgData.height - 8}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#94a3b8"
                        className="font-mono"
                      >
                        {p.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                该周期内暂无体重数据
              </div>
            )}
          </div>

          {renderWeightCal()}

          {/* 历史打卡日志列表 */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5 px-1 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 shrink-0">体重与日记记录</h3>
              <div className="flex items-center gap-1 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/60 text-[10px] font-bold">
                  {([
                    { key: 'all', label: '全部' },
                    { key: 'morning', label: '晨起' },
                    { key: 'post-workout', label: '练后' },
                    { key: 'evening', label: '晚间' },
                  ] as const).map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setSlotFilter(f.key)}
                      className={`px-2 py-0.5 rounded-lg transition-all ${
                        slotFilter === f.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">共 {visibleWeights.length} 条</span>
              </div>
            </div>

            <div className="space-y-2">
              {visibleWeights.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 font-mono">{log.weight} kg</span>
                      <button
                        type="button"
                        onClick={() => setSlotFilter(log.timeSlot || 'morning')}
                        className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium hover:bg-emerald-50 hover:text-emerald-700"
                        title="按此时段过滤"
                      >
                        {SLOT_SHORT[log.timeSlot || 'morning']}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputDate(log.date)}
                        className="text-xs text-slate-400 font-medium hover:text-blue-600 hover:underline"
                        title="跳到该日期打卡"
                      >
                        {log.date}
                      </button>
                    </div>

                    {log.note && (
                      <div className="flex items-start gap-1.5 text-xs text-emerald-800 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{log.note}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => promptDeleteWeight(log.id, log.date, log.weight)}
                    className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="删除此条记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {visibleWeights.length === 0 && (
                <div className="text-center py-8 bg-white border border-slate-200 rounded-xl text-slate-400 text-xs">
                  当前筛选下没有记录
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 数据安全与备份中心 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm mt-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">本地数据中心与官方记录</h3>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          所有计划、训练动作与体重日记 100% 保存在本地。可随时导出 JSON 备份或恢复 10.06 - 10.09 官方真实记录。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleRestoreOfficialData}
            className="py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 恢复 10.06-10.09 真实记录
          </button>

          <button
            onClick={handleExportBackup}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" /> 导出 JSON 备份
          </button>

          <label className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-600" /> 导入恢复备份
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

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
