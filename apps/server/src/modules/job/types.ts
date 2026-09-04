import type {
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  Settlement,
} from '@prisma/client';

// 岗位 VO（服务端 JobPostVo；前端 services/job.ts 镜像定义）
export interface JobPostVo {
  id: string;
  merchantId: string;
  merchantShopName: string;
  publisherName: string | null;
  title: string;
  description: string;
  requirements: string | null;
  contactPhone: string | null;
  contactWechat: string | null;
  contactInstruction: string | null;
  salary: string;
  salaryAmount: number | null;
  location: string;
  locationPoiId: string | null;
  locationLng: number | null;
  locationLat: number | null;
  locationCity: string | null;
  category: JobCategory | null;
  customCategory: string | null;
  settlement: Settlement | null;
  workDates: string[];
  workPeriods: string[];
  headcount: number;
  urgent: boolean;
  featured: boolean;
  online: boolean;
  questions: string[];
  duration: JobDuration;
  expireAt: string | null;
  validityText: string;
  visibilityScope: JobVisibilityScope;
  applyMode: JobApplyMode;
  isExternalSource: boolean;
  platformPublished: boolean;
  status: JobPostStatus;
  takenDownAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  editedFromStatus?: string;
  needsRepublish?: boolean;
}
