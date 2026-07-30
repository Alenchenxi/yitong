import { request } from './request';

export interface TicketVo {
  id: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  reply: string | null;
  createdAt: string;
  repliedAt: string | null;
}

// M5-06 意见反馈：复用 support 工单接口，role 按当前角色传
export function createTicket(data: { role: 'user' | 'merchant'; title: string; content: string }) {
  return request<TicketVo>({ url: '/support/tickets', method: 'POST', data });
}

export function listMyTickets() {
  return request<TicketVo[]>({ url: '/support/tickets' });
}
