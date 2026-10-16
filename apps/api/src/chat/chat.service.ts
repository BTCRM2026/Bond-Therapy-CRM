import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEAM_KEY = 'team';
const PAGE_SIZE = 60;
const internalUser = { status: 'ACTIVE' as const, roles: { some: { role: { isActive: true, portal: { in: ['ADMIN' as const, 'STAFF' as const] } } } } };

type MessageRow = { id: string; senderId: string; body: string; createdAt: Date; deletedAt: Date | null; sender: { name: string } };
const present = (message: MessageRow) => ({ id: message.id, senderId: message.senderId, senderName: message.sender.name, body: message.deletedAt ? '' : message.body, deleted: Boolean(message.deletedAt), createdAt: message.createdAt });

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // The team channel is shared by every internal user; membership is created on first use so read state can be tracked.
  private async joinTeam(userId: string) {
    const team = await this.prisma.chatConversation.upsert({ where: { key: TEAM_KEY }, update: {}, create: { type: 'TEAM', key: TEAM_KEY } });
    await this.prisma.chatMember.upsert({ where: { conversationId_userId: { conversationId: team.id, userId } }, update: {}, create: { conversationId: team.id, userId } });
    return team;
  }

  private unreadCount(conversationId: string, userId: string, since: Date) {
    return this.prisma.chatMessage.count({ where: { conversationId, createdAt: { gt: since }, senderId: { not: userId }, deletedAt: null } });
  }

  private canModerate(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  async conversations(actor: SessionUser) {
    await this.joinTeam(actor.id);
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId: actor.id },
      include: {
        conversation: {
          include: {
            members: { where: { userId: { not: actor.id } }, include: { user: { select: { id: true, name: true } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { name: true } } } },
          },
        },
      },
    });
    const items = await Promise.all(memberships.map(async ({ conversation, lastReadAt }) => {
      const last = conversation.messages[0];
      const other = conversation.members[0]?.user;
      return {
        id: conversation.id,
        type: conversation.type,
        title: conversation.type === 'TEAM' ? 'Everyone' : other?.name ?? 'Team member',
        userId: other?.id ?? null,
        lastMessage: last ? { body: last.deletedAt ? 'Message deleted' : last.body, senderName: last.sender.name, mine: last.senderId === actor.id, createdAt: last.createdAt } : null,
        lastMessageAt: conversation.lastMessageAt,
        unread: await this.unreadCount(conversation.id, actor.id, lastReadAt),
      };
    }));
    items.sort((a, b) => (a.type === b.type ? b.lastMessageAt.getTime() - a.lastMessageAt.getTime() : a.type === 'TEAM' ? -1 : 1));
    return { me: { id: actor.id, name: actor.name, canModerate: this.canModerate(actor) }, conversations: items };
  }

  async summary(actor: SessionUser) {
    const memberships = await this.prisma.chatMember.findMany({ where: { userId: actor.id }, select: { conversationId: true, lastReadAt: true } });
    const counts = await Promise.all(memberships.map((member) => this.unreadCount(member.conversationId, actor.id, member.lastReadAt)));
    return { unread: counts.reduce((sum, value) => sum + value, 0) };
  }

  async people(actor: SessionUser) {
    const users = await this.prisma.user.findMany({
      where: { ...internalUser, id: { not: actor.id } },
      select: { id: true, name: true, roles: { where: { role: { isActive: true, portal: { in: ['ADMIN', 'STAFF'] } } }, select: { role: { select: { name: true, priority: true } } } } },
      orderBy: { name: 'asc' },
    });
    return users.map((user) => ({ id: user.id, name: user.name, roleName: [...user.roles].sort((a, b) => a.role.priority - b.role.priority)[0]?.role.name ?? 'Team member' }));
  }

  async startDirect(actor: SessionUser, userId: string) {
    if (userId === actor.id) throw new BadRequestException('Choose another team member to chat with.');
    const target = await this.prisma.user.findFirst({ where: { ...internalUser, id: userId }, select: { id: true, name: true } });
    if (!target) throw new NotFoundException('That team member is not available.');
    const key = [actor.id, target.id].sort().join(':');
    const conversation = await this.prisma.chatConversation.upsert({
      where: { key },
      update: {},
      create: { type: 'DIRECT', key, members: { create: [{ userId: actor.id }, { userId: target.id }] } },
    });
    return { id: conversation.id, type: conversation.type, title: target.name, userId: target.id };
  }

  // Only conversation members may read or write; the team channel is open to every internal user.
  private async access(actor: SessionUser, id: string) {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.type === 'TEAM') await this.joinTeam(actor.id);
    else if (!(await this.prisma.chatMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: actor.id } }, select: { id: true } }))) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  async messages(actor: SessionUser, id: string, before?: string) {
    const conversation = await this.access(actor, id);
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) throw new BadRequestException('Invalid date.');
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId: id, ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      include: { sender: { select: { name: true } } },
    });
    rows.reverse();
    // Opening or polling a thread counts as reading it (paging back through history does not).
    if (!beforeDate) await this.prisma.chatMember.updateMany({ where: { conversationId: id, userId: actor.id }, data: { lastReadAt: new Date() } });
    const other = conversation.type === 'DIRECT' ? await this.prisma.chatMember.findFirst({ where: { conversationId: id, userId: { not: actor.id } }, select: { lastReadAt: true } }) : null;
    return { messages: rows.map(present), hasMore: rows.length === PAGE_SIZE, otherLastReadAt: other?.lastReadAt ?? null };
  }

  async send(actor: SessionUser, id: string, body: string) {
    await this.access(actor, id);
    const text = body.trim();
    if (!text) throw new BadRequestException('Type a message first.');
    const message = await this.prisma.chatMessage.create({ data: { conversationId: id, senderId: actor.id, body: text }, include: { sender: { select: { name: true } } } });
    await this.prisma.$transaction([
      this.prisma.chatConversation.update({ where: { id }, data: { lastMessageAt: message.createdAt } }),
      this.prisma.chatMember.updateMany({ where: { conversationId: id, userId: actor.id }, data: { lastReadAt: message.createdAt } }),
    ]);
    return present(message);
  }

  async remove(actor: SessionUser, id: string, ipAddress?: string) {
    if (!this.canModerate(actor)) throw new ForbiddenException('Only an administrator can delete chat messages.');
    const message = await this.prisma.chatMessage.findUnique({ where: { id }, select: { id: true, conversationId: true, senderId: true, deletedAt: true } });
    if (!message) throw new NotFoundException('Message not found.');
    if (!message.deletedAt) {
      await this.prisma.chatMessage.update({ where: { id }, data: { deletedAt: new Date() } });
      await recordAudit(this.prisma, { actorId: actor.id, action: 'CHAT_MESSAGE_DELETE', entity: 'CHAT_MESSAGE', entityId: id, details: { conversationId: message.conversationId, senderId: message.senderId }, ipAddress });
    }
    return { ok: true };
  }
}
