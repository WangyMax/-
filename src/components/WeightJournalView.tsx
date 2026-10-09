import { useState, useEffect } from 'react';
import { 
  Scale, Plus, TrendingDown, TrendingUp, 
  Trash2, Download, Upload, CheckCircle2, MessageSquare
} from 'lucide-react';
import { WeightLog } from '../types';
import { StorageService } from '../utils/storage';

interface WeightJournalViewProps {
  onDataChanged?: () => void;
}

export const WeightJournalView: React.FC<WeightJournalViewProps> = ({
  onDataChanged,
}) => {
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [inputWeight, setInputWeight] = useState('63.2');
  const [inputDate, setInputDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inputSlot, setInputSlot] = useState<'morning' | 'evening' | 'post-workout'>('morning');
  const [inputNote, setInputNote] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    refreshLogs();
  }, []);

  const refreshLogs = () => {
    setWeights(StorageService.getWeightLogs());
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
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

    refreshLogs();
    setInputNote('');
    if (onDataChanged) onDataChanged();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定删除该条体重记录吗？')) {
      StorageService.deleteWeightLog(id);
      refreshLogs();
      if (onDataChanged) onDataChanged();
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
        refreshLogs();
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
    <div className="pb-24 pt-2 space-y-5">
      {/* 头部标题 */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">体重与生活日志</h1>
        <p className="text-xs text-slate-500 mt-0.5">记录日常体重波动、饮食与身体恢复感受</p>
      </div>

      {/* 快捷录入卡片 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">打卡今日体重与饮食</h3>
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
                  onChange={(e) => setInputWeight(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-extrabold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
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
                    onClick={() => setInputSlot(s.key as 'morning' | 'evening' | 'post-workout')}
                    className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${
                      inputSlot === s.key
                        ? 'bg-emerald-600 text-white font-bold shadow-sm'
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
              onChange={(e) => setInputNote(e.target.value)}
              placeholder="例如: 晚上吃了鸡公煲，蛋白质充足；昨晚深蹲膝盖微酸..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200"
            />

            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> 记录打卡
            </button>
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
                  onClick={() => handleDelete(log.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 数据安全与备份中心 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">本地数据中心</h3>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          所有计划、训练动作与体重日记 100% 保存在你的浏览器本地。可随时导出 JSON 备份或跨设备导入。
        </p>

        {importStatus && (
          <div className="mb-3 p-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {importStatus}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" /> 导出 JSON 备份
          </button>

          <label className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
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
