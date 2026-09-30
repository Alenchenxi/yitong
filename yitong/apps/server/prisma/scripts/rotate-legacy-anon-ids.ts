import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface Options {
  apply: boolean;
  limit: number;
}

function parseOptions(): Options {
  const args = new Set(process.argv.slice(2));
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 500;
  return {
    apply: args.has('--apply'),
    limit: Number.isInteger(limit) && limit > 0 ? limit : 500,
  };
}

function generateAnonId(): string {
  return `anon_${randomUUID().replace(/-/g, '')}`;
}

function isLegacyUnsafeAnonId(userId: string, anonId: string): boolean {
  return anonId.startsWith(`anon_${userId.slice(-6)}_`);
}

async function createUniqueAnonId() {
  for (let i = 0; i < 5; i += 1) {
    const anonId = generateAnonId();
    const existing = await prisma.anonymousProfile.findUnique({ where: { anonId }, select: { id: true } });
    if (!existing) return anonId;
  }
  throw new Error('failed to generate unique anonId after 5 attempts');
}

async function rotateProfile(profile: { id: string; userId: string; anonId: string }) {
  const nextAnonId = await createUniqueAnonId();
  await prisma.$transaction(async (tx) => {
    await tx.anonymousPost.updateMany({ where: { anonId: profile.anonId }, data: { anonId: nextAnonId } });
    await tx.anonPostLike.updateMany({ where: { anonId: profile.anonId }, data: { anonId: nextAnonId } });
    await tx.chatMatch.updateMany({ where: { anonIdA: profile.anonId }, data: { anonIdA: nextAnonId } });
    await tx.chatMatch.updateMany({ where: { anonIdB: profile.anonId }, data: { anonIdB: nextAnonId } });
    await tx.chatMessage.updateMany({ where: { fromId: profile.anonId }, data: { fromId: nextAnonId } });
    await tx.chatMessage.updateMany({ where: { toId: profile.anonId }, data: { toId: nextAnonId } });
    await tx.chatSession.updateMany({ where: { ownerId: profile.anonId }, data: { ownerId: nextAnonId } });
    await tx.chatSession.updateMany({ where: { peerId: profile.anonId }, data: { peerId: nextAnonId } });
    await tx.anonymousProfile.update({ where: { id: profile.id }, data: { anonId: nextAnonId } });
  });
  return nextAnonId;
}

async function main() {
  const opts = parseOptions();
  const profiles = await prisma.anonymousProfile.findMany({
    orderBy: { createdAt: 'asc' },
    take: opts.limit,
    select: { id: true, userId: true, anonId: true },
  });
  const unsafe = profiles.filter((p) => isLegacyUnsafeAnonId(p.userId, p.anonId));
  console.log(`scan=${profiles.length} unsafe=${unsafe.length} mode=${opts.apply ? 'apply' : 'dry-run'}`);
  for (const profile of unsafe) {
    if (!opts.apply) {
      console.log(`would rotate profile=${profile.id} user=${profile.userId} anon=${profile.anonId}`);
      continue;
    }
    try {
      const nextAnonId = await rotateProfile(profile);
      console.log(`rotated profile=${profile.id} ${profile.anonId} -> ${nextAnonId}`);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        console.error(`failed profile=${profile.id} code=${e.code}`);
      } else {
        console.error(`failed profile=${profile.id} error=${(e as Error).message}`);
      }
      process.exitCode = 1;
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
