import type {
  AppStatus,
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
  publishedAt: string | null; // P2-74 首次发布时间（null=从未发布过）
  canFreeRepublish: boolean; // P2-74 PENDING+已发布过+原有效期未过 → 可免付费直接重发
  deletedAt: string | null;
  createdAt: string;
  myApplication?: {
    id: string;
    status: AppStatus;
    conversationId: string | null;
  } | null;
  editedFromStatus?: string;
  needsRepublish?: boolean;
}
