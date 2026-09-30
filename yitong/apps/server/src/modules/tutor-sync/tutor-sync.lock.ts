import type { Prisma } from '@prisma/client';
import { TUTOR_SYNC_SOURCE } from './tutor-sync.types';

const TUTOR_SYNC_LOCK_KEY = `tutor-sync:${TUTOR_SYNC_SOURCE}`;

export async function acquireTutorSyncLock(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${TUTOR_SYNC_LOCK_KEY}))`;
}

export async function tryAcquireTutorSyncLock(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<boolean> {
  const rows = await tx.$queryRaw<
    Array<{ acquired: boolean }>
  >`SELECT pg_try_advisory_xact_lock(hashtext(${TUTOR_SYNC_LOCK_KEY})) AS acquired`;
  return rows[0]?.acquired === true;
}
