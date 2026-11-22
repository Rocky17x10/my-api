import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { SupportTicketStatus } from './support-ticket.entity';
import { SupportTicketsService } from './support-tickets.service';

describe('SupportTicketsService internal notes', () => {
  const save = jest.fn();
  // Runs the transaction callback at once with a stand-in manager.
  const manager = { getRepository: () => ({ save, find: jest.fn().mockResolvedValue([]) }) } as unknown as EntityManager;
  const ticketRepository = {
    findOne: jest.fn(),
    manager: { transaction: (work: (m: EntityManager) => Promise<unknown>) => work(manager) },
  };
  const messageRepository = { create: jest.fn((m: object) => m) };
  const userRepository = { findOneBy: jest.fn().mockResolvedValue({ id: 1, name: 'Admin' }) };
  const notifications = { createNotification: jest.fn() };
  const service = new SupportTicketsService(
    ticketRepository as never,
    messageRepository as never,
    userRepository as never,
    notifications as unknown as NotificationsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    ticketRepository.findOne.mockResolvedValue({
      id: 5,
      ticketNumber: 'IT-2026-0005',
      status: SupportTicketStatus.WAITING_FOR_EMPLOYEE,
      createdBy: { id: 2 },
    });
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
  });

  it('refuses an internal note from an employee before touching the database', async () => {
    await expect(service.addMessage(5, 2, 'note', false, true)).rejects.toThrow(ForbiddenException);
    expect(ticketRepository.findOne).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('stores an admin internal note without notifying anyone or changing the status', async () => {
    await service.addMessage(5, 1, 'note', true, true);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ isInternalNote: true }));
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('still notifies the employee about a normal admin reply', async () => {
    await service.addMessage(5, 1, 'reply', true, false);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ isInternalNote: false }));
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification.mock.calls[0][0]).toBe(2);
  });
});
