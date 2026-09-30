import { Injectable } from '@nestjs/common';
import { parseSalaryAmount } from '../../common/job/parse-salary-amount';
import type { AdaptedTutorJob, TutorDemandSnapshotItem } from './tutor-sync.types';

const BEIJING_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const TEACHING_WAY_LABELS: Readonly<Record<string, string>> = {
  '0': '均可',
  '1': '上门授课',
  '2': '在线授课',
  '3': '均可',
};

const TEACHER_GENDER_LABELS: Readonly<Record<string, string>> = {
  '0': '不限',
  '1': '男',
  '2': '女',
  '3': '不限',
};

const TEACHER_IDENTITY_LABELS: Readonly<Record<string, string>> = {
  '0': '不限',
  '1': '大学生教员',
  '2': '专职教员',
  '3': '不限',
};

@Injectable()
export class TutorDemandAdapter {
  adapt(item: TutorDemandSnapshotItem): AdaptedTutorJob {
    const titleParts = [item.gradeName, item.subjectName].filter(Boolean);
    const locationParts = this.unique([item.province, item.city, item.area, item.address]);

    return {
      externalId: item.demandId,
      active: item.status === 1 && item.isHide === 0 && item.isRefund === 0,
      title: titleParts.length > 0 ? `${titleParts.join('')}家教` : '家教兼职',
      description: this.joinLines([
        ['需求概况', item.overview],
        ['授课时间', this.teachTimeLabel(item.teachTime)],
        ['授课方式', this.sourceLabel(item.teachingWay, TEACHING_WAY_LABELS)],
        ['学校', item.school],
      ]) || '家教兼职，具体安排请联系发布方。',
      requirements: this.joinLines([
        ['性别要求', this.sourceLabel(item.teacherGender, TEACHER_GENDER_LABELS)],
        ['身份要求', this.sourceLabel(item.teacherIdentity, TEACHER_IDENTITY_LABELS)],
        ['其他要求', item.teacherRequire],
      ]) || null,
      salary: item.expense || '薪资面议',
      salaryAmount: parseSalaryAmount(item.expense),
      location: locationParts.join(' ') || '地点待沟通',
      locationLng: this.validCoordinate(item.longitude, -180, 180),
      locationLat: this.validCoordinate(item.latitude, -90, 90),
      locationCity: item.city || null,
      createdAt: item.createTime,
    };
  }

  private joinLines(entries: Array<[string, string]>): string {
    return entries
      .filter(([, value]) => value.length > 0)
      .map(([label, value]) => `${label}：${value}`)
      .join('\n');
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }

  private sourceLabel(value: string, labels: Readonly<Record<string, string>>): string {
    const normalized = value.trim();
    return labels[normalized] ?? normalized;
  }

  private teachTimeLabel(value: string): string {
    const normalized = value.trim();
    if (normalized === '0') return '待协商';
    if (!/^\d{10}$/.test(normalized)) return normalized;

    const parts = new Map(
      BEIJING_TIME_FORMATTER.formatToParts(new Date(Number(normalized) * 1000)).map((part) => [
        part.type,
        part.value,
      ]),
    );
    const year = parts.get('year');
    const month = parts.get('month');
    const day = parts.get('day');
    const hour = parts.get('hour');
    const minute = parts.get('minute');
    const second = parts.get('second');
    if (!year || !month || !day || !hour || !minute || !second) return normalized;

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  private validCoordinate(value: number | null, min: number, max: number): number | null {
    return value !== null && Number.isFinite(value) && value >= min && value <= max ? value : null;
  }
}
