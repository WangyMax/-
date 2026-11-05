import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { MedicationConfig } from '../types';
import { shiftLocalDate, todayLocalDate } from './date';
import { intervalDaysOf, nextSlotOnOrAfter, slotTimestamp } from './medication';

/**
 * 把「隔 N 天 / 固定时刻」的用药计划导出成一个 .ics 日历文件。
 *
 * 为什么用 .ics 而不是直接写系统日历：
 *  - 直接写 CalendarContract 需要 READ/WRITE_CALENDAR 运行时权限 + 自研原生插件，
 *    还要自己挑可写日历、写 Reminders 表，出错时是"静默不提醒"，风险远高于收益；
 *  - .ics 里带 RRULE（FREQ=DAILY;INTERVAL=2）和 VALARM，用户导入一次后由系统日历
 *    自己负责隔天提醒，完全不依赖 App 是否被后台清理，是最稳的"系统级"提醒；
 *  - 文件生成与分享都走 Capacitor 官方插件，Web 预览下退化成浏览器下载，不会抛错。
 *
 * 文件内的 DTSTART 使用"浮动本地时间"（不带 Z），系统日历会按设备时区解释，
 * 换时区也不会漂移。
 */

export const MED_ICS_FILE_NAME = 'fitcustom-用药提醒.ics';

const ICS_END_OF_LINE = '\r\n';
const EVENT_MINUTES = 15;
/** 日历事件的 UID 前缀：同一个用药计划反复导入时日历会更新而不是堆叠多条 */
const UID_PREFIX = 'fitcustom-medication@fitcustom.pro';

export interface MedicationIcs {
  content: string;
  fileName: string;
  /** 事件起始槽位日（yyyy-MM-dd） */
  startDate: string;
  /** 重复间隔天数 */
  stepDays: number;
}

/** iCalendar 文本转义：反斜杠、分号、逗号、换行 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地时间 → 20261106T120000（浮动时间，不带 Z） */
function formatIcsLocal(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** UTC 时间 → 20261106T040000Z（DTSTAMP 必须是 UTC） */
function formatIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * RFC 5545 折行：单行不超过 75 个八位字节（UTF-8 中文一个字 3 字节），
 * 折出来的续行以空格开头。按字符边界切，不会把汉字劈成半个。
 */
function foldIcsLines(lines: string[]): string[] {
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const folded: string[] = [];
  for (const line of lines) {
    let current = '';
    let bytes = 0;
    for (const char of line) {
      const size = encoder ? encoder.encode(char).length : char.length;
      if (bytes + size > 73 && current) {
        folded.push(current);
        current = ' ';
        bytes = 1;
      }
      current += char;
      bytes += size;
    }
    folded.push(current);
  }
  return folded;
}

/**
 * 生成用药提醒的 .ics 内容。从「今天或之后最近、且时间点还没过」的槽位开始，
 * 用 RRULE:FREQ=DAILY;INTERVAL=<stepDays> 表达"隔天一次"。
 */
export function buildMedicationIcs(
  config: MedicationConfig,
  fromDate: string = todayLocalDate(),
  now: Date = new Date(),
): MedicationIcs {
  let startDate = nextSlotOnOrAfter(config, fromDate);
  let start = new Date(slotTimestamp(startDate, config.reminderTime));
  // 今天的槽位时间点已经过了：第一次提醒从下一个槽位开始，避免迁到过去的时间
  if (start.getTime() <= now.getTime()) {
    startDate = nextSlotOnOrAfter(config, shiftLocalDate(startDate, 1));
    start = new Date(slotTimestamp(startDate, config.reminderTime));
  }
  const end = new Date(start.getTime() + EVENT_MINUTES * 60 * 1000);
  const stepDays = intervalDaysOf(config);
  const title = `服用${config.name}${config.dosage ? ` ${config.dosage}` : ''}`;
  const description = [
    `${config.name}${config.dosage ? ` ${config.dosage}` : ''} · ${config.reminderTime}`,
    `重复：每 ${stepDays} 天一次（导入后由系统日历负责提醒）`,
    'App 内记录：FitCustom Pro → 计划分化 → 用药管理',
  ].join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitCustom Pro//Medication//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${config.name}提醒`)}`,
    'BEGIN:VEVENT',
    `UID:${UID_PREFIX}-${startDate}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsLocal(start)}`,
    `DTEND:${formatIcsLocal(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `RRULE:FREQ=DAILY;INTERVAL=${stepDays}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT0M',
    `DESCRIPTION:${escapeIcsText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return {
    content: `${foldIcsLines(lines).join(ICS_END_OF_LINE)}${ICS_END_OF_LINE}`,
    fileName: MED_ICS_FILE_NAME,
    startDate,
    stepDays,
  };
}

export interface IcsExportResult {
  ok: boolean;
  /** 给用户看的一句话结论 */
  message: string;
  /** 原生端分享出去的文件路径（Web 端为空） */
  path?: string;
}

/** 浏览器端：走 Blob + a[download]，不支持时退化成提示 */
function downloadInBrowser(ics: MedicationIcs): boolean {
  try {
    const blob = new Blob([ics.content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = ics.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // 交给浏览器下载后再释放，避免部分内核还在读 Blob
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * 导出日历文件：
 *  - 原生端：写入 App 缓存目录并调起系统分享面板（可"保存到文件"/发给日历）；
 *  - 浏览器：直接下载 .ics。
 * 任何失败都只返回 ok:false，不抛异常。
 */
export async function exportMedicationIcs(config: MedicationConfig): Promise<IcsExportResult> {
  const ics = buildMedicationIcs(config);

  if (!Capacitor.isNativePlatform()) {
    return downloadInBrowser(ics)
      ? { ok: true, message: `已生成 ${ics.fileName}，用系统日历打开即可导入。` }
      : { ok: false, message: '当前浏览器不支持直接下载，请改用 App 操作。' };
  }

  try {
    const written = await Filesystem.writeFile({
      path: ics.fileName,
      data: ics.content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    try {
      await Share.share({
        title: '导出用药提醒到系统日历',
        text: '用系统日历打开这个 .ics 文件，即可获得每 N 天一次的重复提醒。',
        files: [written.uri],
        dialogTitle: '导出用药提醒到系统日历',
      });
    } catch {
      // 用户取消分享 / 分享面板不可用：文件已经写好了，仍然算导出成功
    }

    return { ok: true, message: '日历文件已生成，可在分享面板里保存或用日历打开。', path: written.uri };
  } catch {
    return { ok: false, message: '生成日历文件失败，请稍后重试。' };
  }
}
