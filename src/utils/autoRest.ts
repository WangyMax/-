import type { WorkoutSession } from '../types';
import { shiftLocalDate } from './date';

// 自动休息是读取时派生出来的虚拟记录，不写进 localStorage。
// 只补「已经结束的日子」：今天仍可能开练，不提前记为休息。
const MAX_AUTO_REST_DAYS = 400;

export function buildAutoRestSession(date: string): WorkoutSession {
  return {
    id: `sess-auto-rest-${date}`,
    date,
    planName: '休息日 (未训练自动记录)',
    startTime: 0,
    endTime: 0,
    exercises: [],
    cardioMinutes: 0,
    cardioCompleted: false,
    isRestDay: true,
    isAutoRest: true,
    notes: undefined,
  };
}

/**
 * 把空白日合并成休息日，返回「有效记录列表」。
 * - 起点：第一条真实记录那天（最多回溯 400 天，避免异常旧数据拖慢渲染）
 * - 终点：昨天
 * - 已有任何记录（训练或休息）的日期不覆盖
 * 返回结果按日期倒序，与 StorageService.getSessions 保持一致。
 */
export function withAutoRestDays(
  sessions: WorkoutSession[],
  todayStr: string,
  enabled: boolean,
): WorkoutSession[] {
  if (!enabled || sessions.length === 0) return sessions;

  const existingDates = new Set(sessions.map(session => session.date));
  const firstRecordDate = sessions
    .map(session => session.date)
    .sort()[0];
  const lastClosedDate = shiftLocalDate(todayStr, -1);

  let startDate = firstRecordDate;
  const earliestAllowed = shiftLocalDate(todayStr, -(MAX_AUTO_REST_DAYS + 1));
  if (startDate < earliestAllowed) startDate = earliestAllowed;
  if (startDate > lastClosedDate) return sessions;

  const extra: WorkoutSession[] = [];
  let cursor = startDate;
  let guard = 0;
  while (cursor <= lastClosedDate && guard < MAX_AUTO_REST_DAYS) {
    if (!existingDates.has(cursor)) extra.push(buildAutoRestSession(cursor));
    cursor = shiftLocalDate(cursor, 1);
    guard += 1;
  }

  if (extra.length === 0) return sessions;
  return [...sessions, ...extra].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.startTime || 0) - (a.startTime || 0);
  });
}
