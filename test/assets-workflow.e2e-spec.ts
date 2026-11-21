import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';

import type { AssetRequest } from '../src/asset-requests/asset-request.entity';
import type { AssetAssignmentHistory } from '../src/assets/asset-assignment-history.entity';
import type { AssetReturn } from '../src/assets/asset-return.entity';
import { Asset } from '../src/assets/asset.entity';
import type { Page } from '../src/common/pagination';
import type { Maintenance } from '../src/maintenance/maintenance.entity';
import { User } from '../src/users/user.entity';
import { Agent, API, createTestApp, loginAs, makeUser, resetData } from './helpers';

describe('assets, requests, returns and maintenance (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let superAdmin: Agent;
  let admin: Agent;
  let employee: Agent;
  let adminUser: User;
  let emp: User;
  let inactive: User;
  let tags = 0;

  async function createAsset(): Promise<Asset> {
    tags += 1;
    const res = await admin
      .post(`${API}/assets`)
      .send({ assetTag: `E2E-${tags}`, name: `Laptop ${tags}`, category: 'Laptop' })
      .expect(201);
    return res.body as Asset;
  }

  const assign = (assetId: number, userId: number, by = admin) =>
    by.post(`${API}/assets/${assetId}/assign`).send({ userId });

  const requestReturn = async (assetId: number, by = employee): Promise<number> => {
    const res = await by.post(`${API}/asset-returns`).send({ assetId }).expect(201);
    return (res.body as AssetReturn).id;
  };

  const assetStatus = async (id: number) =>
    (await dataSource.getRepository(Asset).findOneByOrFail({ id })).status;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await resetData(dataSource);
    await makeUser(dataSource, 'super_admin', 'super@e2e.test');
    adminUser = await makeUser(dataSource, 'admin', 'admin@e2e.test');
    emp = await makeUser(dataSource, 'user', 'emp@e2e.test');
    inactive = await makeUser(dataSource, 'user', 'inactive@e2e.test', { isActive: false });
    superAdmin = await loginAs(app, 'super@e2e.test');
    admin = await loginAs(app, 'admin@e2e.test');
    employee = await loginAs(app, 'emp@e2e.test');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('assets', () => {
    it('creates an asset; unknown keys are 400 and a duplicate tag is 409', async () => {
      const res = await admin
        .post(`${API}/assets`)
        .send({ assetTag: 'E2E-NEW', name: 'Dell XPS', category: 'Laptop' })
        .expect(201);
      expect(res.body).toMatchObject({ assetTag: 'E2E-NEW', status: 'available', assignedTo: null });

      const base = { assetTag: 'E2E-BAD', name: 'Bad', category: 'Laptop' };
      await admin.post(`${API}/assets`).send({ ...base, assignedTo: emp.id }).expect(400);
      await admin.post(`${API}/assets`).send({ ...base, status: 'assigned' }).expect(400);

      const dup = await admin
        .post(`${API}/assets`)
        .send({ assetTag: 'E2E-NEW', name: 'Dup', category: 'Laptop' })
        .expect(409);
      expect(JSON.stringify(dup.body)).not.toMatch(/Duplicate entry|INSERT/);
    });

    it('assigns and unassigns, recording the assignment history', async () => {
      const asset = await createAsset();

      const assigned = await assign(asset.id, emp.id).expect(201);
      expect(assigned.body).toMatchObject({ status: 'assigned', assignedTo: { id: emp.id } });
      const mine = await employee.get(`${API}/assets`).expect(200);
      expect((mine.body as Page<Asset>).data.map((a) => a.id)).toEqual([asset.id]);

      const unassigned = await admin.patch(`${API}/assets/${asset.id}/unassign`).expect(200);
      expect(unassigned.body).toMatchObject({ status: 'available', assignedTo: null });

      const history = await admin.get(`${API}/assets/${asset.id}/history`).expect(200);
      const rows = history.body as AssetAssignmentHistory[];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ assignedTo: { id: emp.id }, assignedBy: { id: adminUser.id } });
      expect(rows[0].returnedAt).not.toBeNull();
    });

    it('refuses self-assignment (403) and a deactivated assignee (400)', async () => {
      const asset = await createAsset();
      await assign(asset.id, adminUser.id).expect(403);
      const res = await assign(asset.id, inactive.id).expect(400);
      expect(res.body).toMatchObject({ message: 'This account is deactivated.' });
    });

    it('edits an assigned asset when the status is sent back unchanged', async () => {
      const asset = await createAsset();
      await assign(asset.id, emp.id).expect(201);

      const res = await admin
        .patch(`${API}/assets/${asset.id}`)
        .send({ location: 'Desk 7', status: 'assigned' })
        .expect(200);
      expect(res.body).toMatchObject({ location: 'Desk 7', status: 'assigned' });
      await admin.patch(`${API}/assets/${asset.id}`).send({ status: 'retired' }).expect(400);
    });
  });

  describe('asset requests', () => {
    it('employee requests, admin approves once, employee sees the reviewer as id + name', async () => {
      const created = await employee
        .post(`${API}/asset-requests`)
        .send({ itemName: 'Monitor', category: 'Display', reason: 'Second screen' })
        .expect(201);
      expect(created.body).toMatchObject({ status: 'pending', requestedBy: { id: emp.id } });
      const id = (created.body as AssetRequest).id;

      await admin
        .patch(`${API}/asset-requests/${id}/review`)
        .send({ status: 'approved', adminNote: 'Granted' })
        .expect(200);
      await superAdmin
        .patch(`${API}/asset-requests/${id}/review`)
        .send({ status: 'rejected' })
        .expect(409);

      const mine = await employee.get(`${API}/asset-requests/my`).expect(200);
      const request = (mine.body as Page<AssetRequest>).data.find((r) => r.id === id);
      expect(request).toMatchObject({ status: 'approved', adminNote: 'Granted' });
      expect(request?.reviewedBy).toEqual({ id: adminUser.id, name: adminUser.name });
    });

    it('nobody reviews their own request (403)', async () => {
      const created = await admin
        .post(`${API}/asset-requests`)
        .send({ itemName: 'Headset', category: 'Accessory', reason: 'Calls' })
        .expect(201);
      const id = (created.body as AssetRequest).id;

      const res = await admin
        .patch(`${API}/asset-requests/${id}/review`)
        .send({ status: 'approved' })
        .expect(403);
      expect(res.body).toMatchObject({ message: 'You cannot review your own request.' });
      await superAdmin
        .patch(`${API}/asset-requests/${id}/review`)
        .send({ status: 'rejected' })
        .expect(200);
    });
  });

  describe('returns and maintenance', () => {
    it('a damaged return puts the asset in maintenance until its record is completed', async () => {
      const asset = await createAsset();
      await assign(asset.id, emp.id).expect(201);
      const returnId = await requestReturn(asset.id);

      await admin
        .patch(`${API}/asset-returns/${returnId}/review`)
        .send({ status: 'approved', condition: 'damaged', adminNote: 'Cracked screen' })
        .expect(200);
      expect(await assetStatus(asset.id)).toBe('maintenance');

      const list = await admin.get(`${API}/maintenance/asset/${asset.id}`).expect(200);
      const records = list.body as Maintenance[];
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        status: 'in_progress',
        maintenanceType: 'Return inspection',
        problemDescription: 'Returned as damaged: Cracked screen',
      });

      await admin
        .patch(`${API}/maintenance/${records[0].id}/complete`)
        .send({ repairDetails: 'Screen replaced' })
        .expect(200);
      expect(await assetStatus(asset.id)).toBe('available');
    });

    it('unassigning closes a pending return', async () => {
      const asset = await createAsset();
      await assign(asset.id, emp.id).expect(201);
      const returnId = await requestReturn(asset.id);

      await admin.patch(`${API}/assets/${asset.id}/unassign`).expect(200);

      const mine = await employee.get(`${API}/asset-returns/my`).expect(200);
      expect((mine.body as Page<AssetReturn>).data.find((r) => r.id === returnId)).toMatchObject({
        status: 'rejected',
        adminNote: 'Closed automatically: the asset was unassigned.',
      });
      await admin
        .patch(`${API}/asset-returns/${returnId}/review`)
        .send({ status: 'approved', condition: 'good' })
        .expect(409);
    });

    it('an admin cannot review their own return (403)', async () => {
      const asset = await createAsset();
      await assign(asset.id, adminUser.id, superAdmin).expect(201);
      const returnId = await requestReturn(asset.id, admin);
      const review = { status: 'approved', condition: 'good' };

      await admin.patch(`${API}/asset-returns/${returnId}/review`).send(review).expect(403);
      await superAdmin.patch(`${API}/asset-returns/${returnId}/review`).send(review).expect(200);
      expect(await assetStatus(asset.id)).toBe('available');
    });

    it('an open maintenance record blocks status changes (409) until completed', async () => {
      const asset = await createAsset();
      const created = await admin
        .post(`${API}/maintenance`)
        .send({ assetId: asset.id, maintenanceType: 'Repair', problemDescription: 'Fan noise' })
        .expect(201);
      expect(await assetStatus(asset.id)).toBe('maintenance');

      await admin.patch(`${API}/assets/${asset.id}`).send({ status: 'retired' }).expect(409);
      await admin
        .patch(`${API}/maintenance/${(created.body as Maintenance).id}/complete`)
        .send({ cost: 12.5 })
        .expect(200);
      await admin.patch(`${API}/assets/${asset.id}`).send({ status: 'retired' }).expect(200);
    });
  });

  describe('lists', () => {
    it.each(['/assets', '/asset-requests', '/asset-returns', '/maintenance', '/users', '/support-tickets'])(
      '%s returns the page envelope and refuses sort=bogus',
      async (path) => {
        const res = await admin.get(`${API}${path}?limit=2`).expect(200);
        const page = res.body as Page<unknown>;
        expect(Object.keys(page).sort()).toEqual(['data', 'limit', 'page', 'total', 'totalPages']);
        expect(page).toMatchObject({ page: 1, limit: 2, totalPages: Math.ceil(page.total / 2) });
        expect(page.data.length).toBeLessThanOrEqual(2);

        await admin.get(`${API}${path}?sort=bogus`).expect(400);
      },
    );
  });
});
