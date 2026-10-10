import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scale, Plus, TrendingDown, TrendingUp, 
  Trash2, Download, Upload, CheckCircle2, MessageSquare,
  Dumbbell, Flame, RotateCcw, Check, ChevronDown, ChevronUp,
  AlertTriangle, Layers, Coffee
} from 'lucide-react';
import { WeightLog, WorkoutSession } from '../types';
import { StorageService } from '../utils/storage';

interface WeightJournalViewProps {
  onDataChanged?: () => void;
}

export const WeightJournalView: React.FC<WeightJournalViewProps> = ({
  onDataChanged,
}) => {
  // 当前子标签: 'training' | 'weight'
  const [activeSubTab, setActiveSubTab] = useState<'training' | 'weight'>('training');
  
  // 训练记录列表与展开状态集合
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // 体重日志列表与输入状态
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [inputWeight, setInputWeight] = useState('63.3');
  const [inputDate, setInputDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // 体重曲线时间跨度视图: 'week' (周视图/7天) | 'month' (月视图/30天) | 'all' (全部)
  const [chartViewSpan, setChartViewSpan] = useState<'week' | 'month' | 'all'>('week');

  // 内置确认弹窗状态（彻底规避安卓原生 window.confirm 被拦截问题）
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const wList = StorageService.getWeightLogs();
    const sList = StorageService.getSessions();
    setWeights(wList);
    setSessions(sList);
    // 默认所有历史记录全部折叠，不自动展开任何记录
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

  // 一键全部展开 / 全部收起
  const toggleAllSessions = () => {
    if (expandedSessionIds.size === sessions.length) {
      setExpandedSessionIds(new Set());
    } else {
      setExpandedSessionIds(new Set(sessions.map(s => s.id)));
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
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlreadyLogged) return;

    const val = parseFloat(inputWeight);
    if (!val || val <= 0) {
      alert('请输入正确的体重数字！');
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

  // 唤起应用内删除体重确认
  const promptDeleteWeight = (id: string, date: string, weightVal: number) => {
    setConfirmModal({
      isOpen: true,
      title: '删除体重记录',
      description: `确定要彻底删除 ${date} 的 ${weightVal}kg 体重打卡记录吗？删除后将不再复原。`,
      onConfirm: () => {
        StorageService.deleteWeightLog(id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      }
    });
  };

  // 唤起应用内删除训练确认
  const promptDeleteSession = (sessionId: string, planName: string, date: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除历史训练记录',
      description: `确定要彻底删除 ${date} 的 “${planName}” 训练记录吗？此操作无法撤销。`,
      onConfirm: () => {
        StorageService.deleteSession(sessionId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
      }
    });
  };

  // 恢复内置官方数据 (10.06 - 10.09)
  const handleRestoreOfficialData = () => {
    setConfirmModal({
      isOpen: true,
      title: '恢复 10.06 - 10.09 真实记录',
      description: '确定重置并重新载入官方 10.06 - 10.09 四日完整真实训练与体重数据吗？',
      onConfirm: () => {
        StorageService.restoreOfficialData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        refreshData();
        if (onDataChanged) onDataChanged();
        setImportStatus('已恢复 10.06 - 10.09 官方真实记录！');
        setTimeout(() => setImportStatus(null), 3000);
      }
    });
  };

  // 导出 JSON 备份
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitcustom-backup-${new Date().toISOString().split('T')[0]}.json`;
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

  // 统计数据
  const latestWeight = weights[0]?.weight;
  const previousWeight = weights[1]?.weight;
  const weightDiff = latestWeight && previousWeight ? (latestWeight - previousWeight).toFixed(1) : null;

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

  // 生成高保真 SVG 平滑贝塞尔曲线路径（周视图/月视图动态适配不同时间轴跨度）
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
    if (maxVal === minVal) {
      minVal -= 1;
      maxVal += 1;
    } else {
      const margin = (maxVal - minVal) * 0.18;
      minVal -= margin;
      maxVal += margin;
    }

    // 各点坐标映射：周视图下铺满近7天刻度；月视图下呈现30天宽幅全景走势
    const points = list.map((item, idx) => {
      let x: number;
      if (list.length === 1) {
        x = padL + chartW / 2;
      } else if (chartViewSpan === 'month') {
        // 月视图下点间距更加紧凑平缓，展示全月趋势全貌
        const startOffset = padL + chartW * 0.2;
        const availableW = chartW * 0.75;
        x = startOffset + (idx / (list.length - 1)) * availableW;
      } else {
        // 周视图与全部视图：均匀舒展排布
        x = padL + (idx / (list.length - 1)) * chartW;
      }
      const y = padT + chartH - ((item.weight - minVal) / (maxVal - minVal)) * chartH;
      return { x, y, weight: item.weight, date: item.date.slice(5) };
    });

    if (points.length === 1) {
      const p = points[0];
      return {
        width,
        height,
        points,
        linePath: `M ${padL} ${p.y} L ${width - padR} ${p.y}`,
        areaPath: `M ${padL} ${p.y} L ${width - padR} ${p.y} L ${width - padR} ${height - padB} L ${padL} ${height - padB} Z`,
        midVal: ((minVal + maxVal) / 2).toFixed(1),
        minVal: minVal.toFixed(1),
        maxVal: maxVal.toFixed(1),
      };
    }

    // 三次贝塞尔平滑曲线算法
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

    // 面积闭合路径
    const lastP = points[points.length - 1];
    const firstP = points[0];
    const areaPath = `${linePath} L ${lastP.x} ${height - padB} L ${firstP.x} ${height - padB} Z`;

    return {
      width,
      height,
      points,
      linePath,
      areaPath,
      midVal: ((minVal + maxVal) / 2).toFixed(1),
      minVal: minVal.toFixed(1),
      maxVal: maxVal.toFixed(1),
    };
  }, [filteredChartWeights, chartViewSpan]);

  return (
    <div className="pb-24 pt-2 space-y-4">
      {/* 头部标题与双标签切换 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">训练与生活日志</h1>
        <p className="text-xs text-slate-500 mt-0.5">历史打卡归档、日常体重走势与身体状态记录</p>
      </div>

      {/* 顶部子标签分段控制器 (iOS / 现代原生风格磨砂分段器) */}
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

      {/* ===================== TAB 1: 历史训练记录（需求①可点击展开折叠） ===================== */}
      {activeSubTab === 'training' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500">点击卡片展开/收起具体训练组数</span>
            {sessions.length > 0 && (
              <button
                onClick={toggleAllSessions}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
              >
                <Layers className="w-3 h-3" />
                {expandedSessionIds.size === sessions.length ? '全部收起' : '全部展开'}
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
              暂无历史训练记录，去“今日训练”开启第一次打卡吧！
            </div>
          ) : (
            sessions.map((sess) => {
              // 专属渲染：休息日 (Rest Day) 卡片
              if (sess.isRestDay) {
                const restLabelMap: Record<string, string> = {
                  'full_rest': '💤 完全休息 / 充足睡眠',
                  'active_recovery': '🧘 主动恢复 / 轻度拉伸',
                  'busy_or_unwell': '💼 事务休整 / 身体调整',
                };
                return (
                  <div
                    key={sess.id}
                    className="bg-gradient-to-r from-amber-50/90 to-orange-50/50 border border-amber-200/90 rounded-2xl p-4 shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold shrink-0">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-amber-950 text-sm">{sess.planName}</span>
                            <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                              {sess.date}
                            </span>
                            <span className="text-[10px] bg-white text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                              {restLabelMap[sess.restType || 'full_rest'] || '超量恢复'}
                            </span>
                          </div>
                          {sess.notes && (
                            <p className="text-xs text-amber-900 mt-1.5 italic">
                              “{sess.notes}”
                            </p>
                          )}
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
                  </div>
                );
              }

              const isExpanded = expandedSessionIds.has(sess.id);
              const totalCompletedSets = sess.exercises.reduce(
                (sum, e) => sum + e.sets.filter(s => s.completed).length, 0
              );

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

                      {/* 折叠态摘要：展示动作名称简略列表 */}
                      <p className="text-[11px] text-slate-500 truncate">
                        共 {sess.exercises.length} 个动作 · {totalCompletedSets} 组完成: {' '}
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

          {/* 体重看板最新概览 */}
          {latestWeight && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">当前最新体重</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">{latestWeight}</span>
                  <span className="text-xs text-slate-400">kg</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-500 font-medium">较上一次变化</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {weightDiff && parseFloat(weightDiff) > 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <span className="text-base font-bold text-amber-600">+{weightDiff} kg</span>
                    </>
                  ) : weightDiff && parseFloat(weightDiff) < 0 ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span className="text-base font-bold text-emerald-600">{weightDiff} kg</span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">持平</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== 需求②&③: 真正的 SVG 平滑波动曲线图（支持周/月/全部视图） ===================== */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3">
            {/* 顶栏：标题与视图切换按钮 */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> 体重波动曲线
                </span>
                <span className="text-[10px] text-slate-400">平滑贝塞尔走势</span>
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
                  周视图 (近7天)
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
                  月视图 (近30天)
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

            {/* 动态视图说明横幅（明确指示当前视图与数据条数） */}
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
                  {chartViewSpan === 'week' && '周视图已激活：近7日逐日微幅走势'}
                  {chartViewSpan === 'month' && '月视图已激活：过去30天全月跨度走势'}
                  {chartViewSpan === 'all' && '全部历史已激活：全周期累计数据'}
                </span>
              </div>
              <span className="font-mono text-[10px] opacity-80">
                {filteredChartWeights.length} 条记录
              </span>
            </div>

            {/* 区间统计指标指示条 */}
            {chartStats && (
              <div className="grid grid-cols-4 gap-1.5 py-2 px-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">区间最低</span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">{chartStats.min}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">区间最高</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.max}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">平均水平</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">{chartStats.avg}kg</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">区间净变</span>
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
                      {/* 外发光圈 */}
                      <circle cx={p.x} cy={p.y} r="5" fill="#10b981" fillOpacity="0.15" />
                      {/* 核心圆点 */}
                      <circle cx={p.x} cy={p.y} r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      {/* 体重数值气泡 */}
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
                      {/* X 轴日期 */}
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

          {/* 历史打卡日志列表（修复删除按钮） */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h3 className="text-sm font-bold text-slate-800">体重与日记记录</h3>
              <span className="text-xs text-slate-400">共 {weights.length} 条</span>
            </div>

            <div className="space-y-2">
              {weights.map((log) => {
                const slotMap: Record<string, string> = {
                  'morning': '晨起空腹',
                  'evening': '晚间',
                  'post-workout': '练后'
                };

                return (
                  <div
                    key={log.id}
                    className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900 font-mono">{log.weight} kg</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                          {slotMap[log.timeSlot || 'morning']}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{log.date}</span>
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
                );
              })}
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

      {/* ===================== 应用内置通用确认弹窗 (解决安卓 WebView confirm 拦截) ===================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-sm">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{confirmModal.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/20 active:scale-95 transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
