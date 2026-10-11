// 本地日期工具。
// 背景：new Date().toISOString() 取的是 UTC 时间，北京时间（UTC+8）每天0:00–8:00
// 返回的是前一天（已验证）。所有"今天是几号"的场景（休息日匹配、
// 训练归档、体重默认日期、备份文件名）必须用本函数。
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

// 昨天（本地日期），用于休息日补签输入框的默认日期
export function yesterdayLocalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

// 解析 YYYY-MM-DD 为本地日期对象（避免 new Date('YYYY-MM-DD') 被当作 UTC 解析）
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// 日期平移 N 天（可为负数），返回 YYYY-MM-DD
export function shiftLocalDate(dateStr: string, deltaDays: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDate(d);
}

// 星期几：0=周日 … 6=周六
export function weekdayOf(dateStr: string): number {
  return parseLocalDate(dateStr).getDay();
}
