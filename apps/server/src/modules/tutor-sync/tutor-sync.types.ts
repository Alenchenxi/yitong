export const TUTOR_SYNC_SOURCE = 'SENYANG_TUTOR';
export const TUTOR_SYNC_PUBLISHER = '森阳家教';
export const TUTOR_SYNC_CONTACT = '13057867818';
export const TUTOR_SYNC_CONTACT_INSTRUCTION = `此岗位需联系${TUTOR_SYNC_CONTACT}（同微信）`;

export interface TutorDemandSnapshotItem {
  demandId: string;
  province: string;
  city: string;
  area: string;
  address: string;
  subjectName: string;
  gradeName: string;
  overview: string;
  expense: string;
  teachTime: string;
  teacherGender: string;
  teacherIdentity: string;
  teacherRequire: string;
  teachingWay: string;
  school: string;
  longitude: number | null;
  latitude: number | null;
  status: number;
  isHide: number;
  isRefund: number;
  createTime: Date | null;
}

export interface TutorDemandSnapshot {
  version: 1;
  mode: 'full';
  complete: true;
  itemCount: number;
  generatedAt: Date;
  items: TutorDemandSnapshotItem[];
}

export interface AdaptedTutorJob {
  externalId: string;
  active: boolean;
  title: string;
  description: string;
  requirements: string | null;
  salary: string;
  salaryAmount: number | null;
  location: string;
  locationLng: number | null;
  locationLat: number | null;
  locationCity: string | null;
  createdAt: Date | null;
}

export interface TutorSyncResult {
  received: number;
  created: number;
  updated: number;
  withdrawn: number;
  skipped: boolean;
}
