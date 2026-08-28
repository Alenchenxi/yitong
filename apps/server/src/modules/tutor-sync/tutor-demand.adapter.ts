import { Injectable } from '@nestjs/common';
import { parseSalaryAmount } from '../../common/job/parse-salary-amount';
import type { AdaptedTutorJob, TutorDemandSnapshotItem } from './tutor-sync.types';

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
        ['授课时间', item.teachTime],
        ['授课方式', item.teachingWay],
        ['学校', item.school],
      ]) || '家教兼职，具体安排请联系发布方。',
      requirements: this.joinLines([
        ['性别要求', item.teacherGender],
        ['身份要求', item.teacherIdentity],
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

  private validCoordinate(value: number | null, min: number, max: number): number | null {
    return value !== null && Number.isFinite(value) && value >= min && value <= max ? value : null;
  }
}
