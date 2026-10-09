import { useState, useEffect } from 'react';
import { 
  Scale, Plus, TrendingDown, TrendingUp, 
  Trash2, Download, Upload, CheckCircle2, MessageSquare,
  Dumbbell, Flame, RotateCcw, Check
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
  
  // 训练记录列表
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  // 体重日志列表与输入状态
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [inputWeight, setInputWeight] = useState('63.3');
  const [inputDate, setInputDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setWeights(StorageService.getWeightLogs());
    setSessions(StorageService.getSessions());
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

  // 删除某条体重记录
  const handleDeleteWeight = (id: string) => {
    if (window.confirm('确定删除该条体重记录吗？')) {
      StorageService.deleteWeightLog(id);
      refreshData();
      if (onDataChanged) onDataChanged();
    }
  };

  // 删除某次训练记录
  const handleDeleteSession = (sessionId: string, planName: string, date: string) => {
    if (window.confirm(`确定删除 ${date} 的 “${planName}” 训练记录吗？`)) {
      StorageService.deleteSession(sessionId);
      refreshData();
      if (onDataChanged) onDataChanged();
    }
  };

  // 恢复内置官方数据 (10.06 - 10.09)
  const handleRestoreOfficialData = () => {
    if (window.confirm('是否重置并恢复官方 10.06 - 10.09 真实训练记录与体重日志？')) {
      StorageService.restoreOfficialData();
      refreshData();
      if (onDataChanged) onDataChanged();
      setImportStatus('已成功恢复 10.06 - 10.09 真实训练与体重数据！');
      setTimeout(() => setImportStatus(null), 3000);
    }
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

  return (
    <div className="pb-24 pt-2 space-y-4">
      {/* 头部标题与双标签切换 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">训练与生活日志</h1>
        <p className="text-xs text-slate-500 mt-0.5">历史打卡记录归档、日常体重波动与身体状态</p>
      </div>

      {/* 顶部子标签切换器 */}
      <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/80">
        <button
          onClick={() => setActiveSubTab('training')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'training'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5" /> 历史训练记录 ({sessions.length}次)
        </button>

        <button
          onClick={() => setActiveSubTab('weight')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'weight'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
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
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500">已归档训练按日期倒序排列</span>
            <span className="text-[11px] text-blue-600 font-semibold">10.06 - 10.09 真实记录已收录</span>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs">
              暂无历史训练记录，去“今日训练”开启第一次打卡吧！
            </div>
          ) : (
            sessions.map((sess) => {
              const totalCompletedSets = sess.exercises.reduce(
                (sum, e) => sum + e.sets.filter(s => s.completed).length, 0
              );

              return (
                <div
                  key={sess.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all"
                >
                  {/* 记录头部 */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-base">{sess.planName}</span>
                        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {sess.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-500">
                          共完成 <strong className="text-slate-800">{totalCompletedSets}</strong> 组训练
                        </span>
                        {sess.cardioCompleted && (
                          <span className="text-[10px] text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200 flex items-center gap-1 font-bold">
                            <Flame className="w-2.5 h-2.5" /> 附加有氧已完成 ({sess.cardioMinutes || 20}m)
                          </span>
                        )}
                        {!sess.cardioCompleted && sess.cardioMinutes === 0 && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                            腿日无有氧
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSession(sess.id, sess.planName, sess.date)}
                      className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg hover:bg-slate-50 transition-colors"
                      title="删除此条记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 动作与组数明细 */}
                  <div className="mt-3 space-y-2">
                    {sess.exercises.map((e, idx) => {
                      const completedSets = e.sets.filter(s => s.completed);
                      const unitStr = e.currentUnit === 'plates' ? '片' : e.currentUnit === 'assisted' ? '助力' : e.currentUnit === 'bodyweight' ? '自重' : 'kg';
                      const pulleyStr = e.pulleyRatio && e.pulleyRatio !== 'none' ? ` (${e.pulleyRatio})` : '';

                      return (
                        <div key={idx} className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/70 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                              <span>{e.exerciseName}</span>
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

                          {/* 各组小标签 */}
                          <div className="flex flex-wrap gap-1.5">
                            {completedSets.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 font-medium"
                              >
                                {s.weightOrPlates}{unitStr} × {s.reps}次
                              </span>
                            ))}
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
                    <div className="mt-3 p-2 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-1.5 text-xs text-blue-900">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>{sess.notes}</span>
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
                  className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
                />

                {/* 需求 4: 打卡完之后直接灰下去，禁止重复点击 */}
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

          {/* 体重看板统计 */}
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

          {/* 体重趋势图表 */}
          {weights.length >= 2 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-slate-800 block mb-2">近期体重波动曲线</span>
              <div className="h-28 flex items-end gap-2 pt-4 px-2">
                {weights.slice(0, 7).reverse().map((w, _, arr) => {
                  const min = Math.min(...arr.map(a => a.weight)) - 1;
                  const max = Math.max(...arr.map(a => a.weight)) + 1;
                  const heightPercent = Math.max(15, ((w.weight - min) / (max - min)) * 100);

                  return (
                    <div key={w.id} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[10px] text-slate-500 font-mono group-hover:text-emerald-600">{w.weight}</span>
                      <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-16">
                        <div
                          className="w-full bg-emerald-500 group-hover:bg-emerald-600 transition-all rounded-t-lg"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 truncate w-full text-center">
                        {w.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 历史打卡日志列表 */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2.5 px-1">体重与日记记录</h3>
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
                    className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-sm flex items-start justify-between gap-3"
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
                      onClick={() => handleDeleteWeight(log.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
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
    </div>
  );
};
