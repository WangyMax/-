import { WorkoutSession, WorkoutSet } from '../types';
import { shiftLocalDate } from './date';

// 单组 kg 系容量（kg/助力；超级组按阶梯累加）
function setKgVolume(s: WorkoutSet): number {
  if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
    return s.dropStages.reduce(
      (acc, st) =>
        acc + (st.unit === 'kg' || st.unit === 'assisted' ? st.weightOrPlates * st.reps : 0),
      0
    );
  }
  return s.unit === 'kg' || s.unit === 'assisted' ? s.weightOrPlates * s.reps : 0;
}

// 单组插销容量（片×次）
function setPlatesVolume(s: WorkoutSet): number {
  if (s.isDropSet && s.dropStages && s.dropStages.length > 0) {
    return s.dropStages.reduce(
      (acc, st) => acc + (st.unit === 'plates' ? st.weightOrPlates * st.reps : 0),
      0
    );
  }
  return s.unit === 'plates' ? s.weightOrPlates * s.reps : 0;
}

// 整场训练容量（默认只统计已完成组）
export function sessionVolumes(
  session: WorkoutSession,
  completedOnly = true
): { kg: number; plates: number } {
  let kg = 0;
  let plates = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (completedOnly && !s.completed) continue;
      kg += setKgVolume(s);
      plates += setPlatesVolume(s);
    }
  }
  return { kg: Math.round(kg * 10) / 10, plates: Math.round(plates * 10) / 10 };
}

// 容量短字串：2.4t / 320kg / 80片·次，无容量返回 null
export function formatVolumeShort(kg: number, plates: number): string | null {
  const parts: string[] = [];
  if (kg > 0) parts.push(kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`);
  if (plates > 0) parts.push(`${Math.round(plates)}片·次`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// 训练时长（分钟），无起止时间返回 null
export function sessionDurationMin(session: WorkoutSession): number | null {
  if (!session.startTime || !session.endTime) return null;
  const m = Math.round((session.endTime - session.startTime) / 60000);
  return m > 0 ? m : null;
}

// 近 7 天训练次数（含今天，只计非休息）
export function countWeekTrainings(sessions: WorkoutSession[], todayStr: string): number {
  const cutoff = shiftLocalDate(todayStr, -6);
  return sessions.filter(s => !s.isRestDay && s.date >= cutoff && s.date <= todayStr).length;
}

// 连续打卡天数：从今天（或昨天）往前数连续有任意记录的天数
export function computeStreak(sessions: WorkoutSession[], todayStr: string): number {
  const dates = new Set(sessions.map(s => s.date));
  let streak = 0;
  let cursor = todayStr;
  if (!dates.has(cursor)) cursor = shiftLocalDate(cursor, -1);
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftLocalDate(cursor, -1);
  }
  return streak;
}

// 历史总完成组数
export function totalCompletedSetsAll(sessions: WorkoutSession[]): number {
  let n = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (set.completed) n++;
      }
    }
  }
  return n;
}
