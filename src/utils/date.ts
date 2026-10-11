// 本地日期工具。
// 背景：new Date().toISOString() 取的是 UTC 时间，北京时间（UTC+8）每天0:00–8:00
// 返回的是前一天（已验证）。所有"今天是几号"的场景（休息日匹配、
// 训练归档、体重默认日期、备份文件名）必须用本函数。
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
