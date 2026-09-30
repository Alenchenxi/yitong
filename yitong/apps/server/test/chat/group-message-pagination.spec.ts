import { ChatService } from '../../src/modules/chat/chat.service';

function message(id: string, createdAt: Date) {
  return {
    id,
    fromId: 'anon_a',
    toId: null,
    groupId: 'group_a',
    content: id,
    type: 'text',
    duration: null,
    deletedAt: null,
    createdAt,
  };
}

describe('ChatService group message cursor', () => {
  it('uses createdAt and id so messages sharing a timestamp are not skipped', async () => {
    const createdAt = new Date('2026-09-04T10:00:00.000Z');
    const prisma = {
      chatMessage: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            message('message_c', createdAt),
            message('message_b', createdAt),
            message('message_a', createdAt),
          ])
          .mockResolvedValueOnce([message('message_a', createdAt)]),
      },
    };
    const service = new ChatService(prisma as never, {} as never, {} as never);

    const first = await service.listGroupMessages('group_a', undefined, 2);
    expect(first.list.map((item) => item.id)).toEqual(['message_b', 'message_c']);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();

    const second = await service.listGroupMessages('group_a', first.nextCursor!, 2);
    expect(second.list.map((item) => item.id)).toEqual(['message_a']);
    expect(prisma.chatMessage.findMany).toHaveBeenLastCalledWith({
      where: {
        groupId: 'group_a',
        deletedAt: null,
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: 'message_b' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });

  it('keeps accepting the legacy ISO timestamp cursor', async () => {
    const createdAt = new Date('2026-09-04T10:00:00.000Z');
    const prisma = { chatMessage: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ChatService(prisma as never, {} as never, {} as never);

    await service.listGroupMessages('group_a', createdAt.toISOString(), 20);

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        groupId: 'group_a',
        deletedAt: null,
        createdAt: { lt: createdAt },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
  });
});
