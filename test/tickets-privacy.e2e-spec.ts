import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';

import { ActivityLog } from '../src/activity-logs/activity-log.entity';
import type { Asset } from '../src/assets/asset.entity';
import type { Page } from '../src/common/pagination';
import type { Notification } from '../src/notifications/notification.entity';
import { SupportTicketMessage } from '../src/support-tickets/support-ticket-message.entity';
import type { SupportTicket } from '../src/support-tickets/support-ticket.entity';
import { User } from '../src/users/user.entity';
import { Agent, API, createTestApp, loginAs, makeUser, resetData } from './helpers';

describe('support tickets: privacy, notifications and audit (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let admin: Agent;
  let employee: Agent;
  let otherEmployee: Agent;
  let adminUser: User;
  let emp: User;
  let ticketId: number;

  const notifications = async (agent: Agent) =>
    ((await agent.get(`${API}/notifications`).expect(200)).body as Page<Notification>).data;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await resetData(dataSource);
    adminUser = await makeUser(dataSource, 'admin', 'admin@e2e.test');
    emp = await makeUser(dataSource, 'user', 'emp@e2e.test');
    await makeUser(dataSource, 'user', 'other@e2e.test');
    admin = await loginAs(app, 'admin@e2e.test');
    employee = await loginAs(app, 'emp@e2e.test');
    otherEmployee = await loginAs(app, 'other@e2e.test');

    // The employee opens a ticket and the admin replies; no endpoint writes internal notes,
    // so one is inserted directly.
    const opened = await employee
      .post(`${API}/support-tickets`)
      .send({ subject: 'Laptop fan', category: 'hardware', description: 'The fan is very loud.' })
      .expect(201);
    ticketId = (opened.body as SupportTicket).id;
    await admin
      .post(`${API}/support-tickets/${ticketId}/messages`)
      .send({ message: 'Public reply' })
      .expect(201);
    await dataSource.getRepository(SupportTicketMessage).save({
      ticket: { id: ticketId },
      sender: { id: adminUser.id },
      message: 'INTERNAL-ONLY note',
      isInternalNote: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('employee view: no internal notes, staff as id + name only', async () => {
    const res = await employee.get(`${API}/support-tickets/${ticketId}`).expect(200);
    const ticket = res.body as SupportTicket;

    expect(ticket).toMatchObject({ status: 'open', createdBy: { id: emp.id } });
    expect(ticket.ticketNumber).toMatch(/^IT-\d{4}-\d{4}$/);
    expect(ticket.messages.map((m) => m.message)).toEqual(['Public reply']);
    expect(ticket.messages[0].sender).toEqual({ id: adminUser.id, name: adminUser.name });
    expect(JSON.stringify(res.body)).not.toContain('admin@e2e.test');
  });

  it('admin view: includes the internal note and full staff details', async () => {
    const ticket = (await admin.get(`${API}/support-tickets/${ticketId}`).expect(200))
      .body as SupportTicket;

    expect(ticket.messages.map((m) => [m.message, m.isInternalNote])).toEqual([
      ['Public reply', false],
      ['INTERNAL-ONLY note', true],
    ]);
    expect(ticket.messages[0].sender).toMatchObject({ email: 'admin@e2e.test' });
  });

  it("another employee can neither read nor reply to the ticket (403)", async () => {
    await otherEmployee.get(`${API}/support-tickets/${ticketId}`).expect(403);
    await otherEmployee
      .post(`${API}/support-tickets/${ticketId}/messages`)
      .send({ message: 'Me too' })
      .expect(403);
  });

  it('notifications link the ticket: admin for the new ticket, employee for the reply', async () => {
    expect(await notifications(admin)).toContainEqual(
      expect.objectContaining({
        title: 'New IT Support Ticket',
        type: 'support_ticket',
        ticket: expect.objectContaining({ id: ticketId }) as unknown,
      }),
    );
    expect(await notifications(employee)).toContainEqual(
      expect.objectContaining({
        title: 'Admin Replied to Your Ticket',
        ticket: expect.objectContaining({ id: ticketId }) as unknown,
      }),
    );
  });

  it('an asset assignment leaves its audit log and notifies the employee', async () => {
    const created = await admin
      .post(`${API}/assets`)
      .send({ assetTag: 'E2E-AUDIT', name: 'ThinkPad', category: 'Laptop' })
      .expect(201);
    const asset = created.body as Asset;
    await admin.post(`${API}/assets/${asset.id}/assign`).send({ userId: emp.id }).expect(201);

    const logs = await dataSource.getRepository(ActivityLog).find({
      where: { action: 'ASSET_ASSIGNED', entityId: asset.id },
      relations: { actor: true },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entityType: 'asset',
      actor: { id: adminUser.id },
      metadata: { assignedToId: emp.id },
    });

    const viaApi = await admin.get(`${API}/activity-logs?action=ASSET_ASSIGNED`).expect(200);
    expect((viaApi.body as Page<ActivityLog>).data.map((log) => log.entityId)).toEqual([asset.id]);

    expect(await notifications(employee)).toContainEqual(
      expect.objectContaining({ type: 'asset_assigned', referenceId: asset.id, isRead: false }),
    );
  });
});
