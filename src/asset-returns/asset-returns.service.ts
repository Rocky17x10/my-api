
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  IsNull,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';

import { AssetReturn } from '../assets/asset-return.entity';
import { Asset } from '../assets/asset.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { AssetAssignmentHistory } from '../assets/asset-assignment-history.entity';
import { User } from '../users/user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { paginate } from '../common/pagination';
import { AssetReturnQueryDto } from './dto/asset-return.dto';

type ReviewReturnData = {
  status: 'approved' | 'rejected';
  condition?: 'good' | 'damaged' | 'needs_maintenance';
  adminNote?: string;
};

@Injectable()
export class AssetReturnsService {
  constructor(
    @InjectRepository(AssetReturn)
    private readonly assetReturnRepository: Repository<AssetReturn>,

    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,

    @InjectRepository(AssetAssignmentHistory)
    private readonly historyRepository: Repository<AssetAssignmentHistory>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // EMPLOYEE: Submit a return request
  async create(
    userId: number,
    assetId: number,
    employeeNote?: string,
  ) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user ID');
    }

    if (!Number.isInteger(assetId) || assetId <= 0) {
      throw new BadRequestException('Invalid asset ID');
    }

    if (
      employeeNote !== undefined &&
      typeof employeeNote !== 'string'
    ) {
      throw new BadRequestException('Invalid employee note');
    }

    const returnRequest =
      await this.assetReturnRepository.manager.transaction(
        async (manager: EntityManager) => {
          const assetRepo = manager.getRepository(Asset);
          const historyRepo = manager.getRepository(AssetAssignmentHistory);
          const returnRepo = manager.getRepository(AssetReturn);
          const userRepo = manager.getRepository(User);

          const asset = await assetRepo.findOne({
            where: { id: assetId },
            relations: { assignedTo: true },
            lock: { mode: 'pessimistic_write' },
          });

          if (!asset) {
            throw new NotFoundException('Asset not found');
          }

          if (
            asset.status !== 'assigned' ||
            !asset.assignedTo ||
            asset.assignedTo.id !== userId
          ) {
            throw new ForbiddenException(
              'You can only request the return of an asset assigned to you',
            );
          }

          const history = await historyRepo.findOne({
            where: {
              asset: { id: assetId },
              assignedTo: { id: userId },
              returnedAt: IsNull(),
            },
            order: { id: 'DESC' },
            lock: { mode: 'pessimistic_write' },
          });

          if (!history) {
            throw new NotFoundException(
              'Active assignment history not found',
            );
          }

          const existingRequest = await returnRepo.findOne({
            where: {
              assignmentHistory: { id: history.id },
              status: 'pending',
            },
          });

          if (existingRequest) {
            throw new ConflictException(
              'A return request is already pending for this asset',
            );
          }

          const employee = await userRepo.findOne({
            where: { id: userId },
          });

          if (!employee) {
            throw new NotFoundException('Employee not found');
          }

          const newReturnRequest = returnRepo.create({
            asset,
            assignmentHistory: history,
            requestedBy: employee,
            reviewedBy: null,
            status: 'pending',
            condition: null,
            employeeNote: employeeNote?.trim() || null,
            adminNote: null,
            reviewedAt: null,
            confirmedAt: null,
          });

          const savedRequest = await returnRepo.save(newReturnRequest);

          // Record the activity in the same transaction as the return request (SEC-14).
          await this.activityLogsService.createLog(
            {
              actorId: userId,
              action: 'ASSET_RETURN_REQUESTED',
              entityType: 'asset_return',
              entityId: savedRequest.id,
              description: `${savedRequest.requestedBy?.name || 'Employee'} requested to return ${savedRequest.asset?.name || 'an asset'} (${savedRequest.asset?.assetTag || 'unknown tag'}).`,
              metadata: {
                returnRequestId: savedRequest.id,
                assetId,
                assetName: savedRequest.asset?.name,
                assetTag: savedRequest.asset?.assetTag,
                employeeNote: savedRequest.employeeNote,
                status: savedRequest.status,
                requestedBy: {
                  id: userId,
                  name: savedRequest.requestedBy?.name,
                },
              },
            },
            manager,
          );

          return savedRequest;
        },
      );

    return returnRequest;
  }

  // EMPLOYEE: View own return requests
  // The reviewer comes back as id + name only (SEC-13).
  async findMyReturns(userId: number, query: AssetReturnQueryDto) {
    const returns = this.assetReturnRepository
      .createQueryBuilder('assetReturn')
      .leftJoinAndSelect('assetReturn.asset', 'asset')
      .leftJoinAndSelect('assetReturn.assignmentHistory', 'assignmentHistory')
      .leftJoinAndSelect('assetReturn.requestedBy', 'requestedBy')
      .leftJoin('assetReturn.reviewedBy', 'reviewedBy')
      .addSelect(['reviewedBy.id', 'reviewedBy.name'])
      .where('requestedBy.id = :userId', { userId });

    return this.page(returns, query, ['asset.assetTag', 'asset.name']);
  }

  // ADMIN: View all return requests
  async findAllReturns(query: AssetReturnQueryDto) {
    const returns = this.assetReturnRepository
      .createQueryBuilder('assetReturn')
      .leftJoinAndSelect('assetReturn.asset', 'asset')
      .leftJoinAndSelect('assetReturn.assignmentHistory', 'assignmentHistory')
      .leftJoinAndSelect('assetReturn.requestedBy', 'requestedBy')
      .leftJoinAndSelect('assetReturn.reviewedBy', 'reviewedBy');

    return this.page(returns, query, [
      'asset.assetTag',
      'asset.name',
      'requestedBy.name',
    ]);
  }

  // Status filter, LIKE search over the given columns, sort and one page.
  private page(
    returns: SelectQueryBuilder<AssetReturn>,
    query: AssetReturnQueryDto,
    searchColumns: string[],
  ) {
    if (query.status) {
      returns.andWhere('assetReturn.status = :status', { status: query.status });
    }

    if (query.search) {
      returns.andWhere(
        `(${searchColumns.map((column) => `${column} LIKE :search`).join(' OR ')})`,
        { search: `%${query.search}%` },
      );
    }

    return paginate(returns, query, `assetReturn.${query.sort}`);
  }

  // ADMIN: Approve or reject a return request
  async review(
    returnId: number,
    adminId: number,
    data: ReviewReturnData,
  ) {
    if (!Number.isInteger(returnId) || returnId <= 0) {
      throw new BadRequestException('Invalid return request ID');
    }

    if (!Number.isInteger(adminId) || adminId <= 0) {
      throw new BadRequestException('Invalid admin ID');
    }

    if (
      !data ||
      !['approved', 'rejected'].includes(data.status)
    ) {
      throw new BadRequestException(
        'Status must be approved or rejected',
      );
    }

    if (
      data.adminNote !== undefined &&
      typeof data.adminNote !== 'string'
    ) {
      throw new BadRequestException('Invalid admin note');
    }

    const validConditions = [
      'good',
      'damaged',
      'needs_maintenance',
    ];

    if (
      data.status === 'approved' &&
      !validConditions.includes(data.condition as string)
    ) {
      throw new BadRequestException(
        'Please select a valid equipment condition',
      );
    }

    if (
      data.condition !== undefined &&
      !validConditions.includes(data.condition)
    ) {
      throw new BadRequestException('Invalid equipment condition');
    }

    const returnRequest =
      await this.assetReturnRepository.manager.transaction(
        async (manager: EntityManager) => {
          const returnRepo = manager.getRepository(AssetReturn);
          const assetRepo = manager.getRepository(Asset);
          const historyRepo = manager.getRepository(AssetAssignmentHistory);
          const userRepo = manager.getRepository(User);

          // Lock the return request
          const lockedRequest = await returnRepo.findOne({
            where: { id: returnId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!lockedRequest) {
            throw new NotFoundException('Return request not found');
          }

          if (lockedRequest.status !== 'pending') {
            throw new ConflictException(
              'This return request has already been reviewed',
            );
          }

          // Load the request's related records
          const request = await returnRepo.findOne({
            where: { id: returnId },
            relations: {
              asset: true,
              assignmentHistory: true,
              requestedBy: true,
            },
          });

          if (
            !request ||
            !request.asset ||
            !request.assignmentHistory ||
            !request.requestedBy
          ) {
            throw new NotFoundException(
              'Return request information is incomplete',
            );
          }

          const admin = await userRepo.findOne({
            where: { id: adminId },
          });

          if (!admin) {
            throw new NotFoundException('Admin not found');
          }

          // Separation of duties (D3): an admin's own return is reviewed by another admin.
          if (request.requestedBy.id === admin.id) {
            throw new ForbiddenException('You cannot review your own return.');
          }

          // Lock the asset
          const asset = await assetRepo.findOne({
            where: { id: request.asset.id },
            relations: { assignedTo: true },
            lock: { mode: 'pessimistic_write' },
          });

          if (!asset) {
            throw new NotFoundException('Asset not found');
          }

          // Lock the assignment history
          const history = await historyRepo.findOne({
            where: { id: request.assignmentHistory.id },
            lock: { mode: 'pessimistic_write' },
          });

          if (!history) {
            throw new NotFoundException('Assignment history not found');
          }

          const now = new Date();

          if (data.status === 'approved') {
            if (
              asset.status !== 'assigned' ||
              !asset.assignedTo ||
              asset.assignedTo.id !== request.requestedBy.id ||
              history.returnedAt !== null
            ) {
              throw new ConflictException(
                'The asset assignment has changed. This return cannot be approved.',
              );
            }

            // Close assignment history
            history.returnedAt = now;
            await historyRepo.save(history);

            // Update asset
            asset.assignedTo = null;

            asset.status =
              data.condition === 'good'
                ? 'available'
                : 'maintenance';

            await assetRepo.save(asset);

            // A damaged return opens its maintenance record at once, so the asset's
            // "maintenance" status always has a record whose completion frees it.
            if (asset.status === 'maintenance') {
              const note = data.adminNote?.trim();
              const record = await manager.getRepository(Maintenance).save({
                asset: { id: asset.id },
                createdBy: { id: admin.id },
                maintenanceType: 'Return inspection',
                problemDescription: `Returned as ${data.condition}${note ? `: ${note}` : ''}`,
                startDate: now,
                cost: 0,
                status: 'in_progress',
              });

              await this.activityLogsService.createLog(
                {
                  actorId: admin.id,
                  action: 'MAINTENANCE_CREATED',
                  entityType: 'maintenance',
                  entityId: record.id,
                  description: `${admin.name} opened maintenance for ${asset.name} (${asset.assetTag}) after a ${data.condition} return.`,
                  metadata: {
                    assetId: asset.id,
                    returnId: request.id,
                    condition: data.condition,
                  },
                },
                manager,
              );
            }

            request.condition = data.condition!;
            request.confirmedAt = now;
          } else {
            // Rejection leaves the assignment unchanged
            request.condition = null;
            request.confirmedAt = null;
          }

          request.status = data.status;
          request.reviewedBy = admin;
          request.reviewedAt = now;
          request.adminNote = data.adminNote?.trim() || null;

          await returnRepo.save(request);

          const savedRequest = await returnRepo.findOne({
            where: { id: returnId },
            relations: {
              asset: true,
              assignmentHistory: true,
              requestedBy: true,
              reviewedBy: true,
            },
          });

          if (!savedRequest) {
            throw new NotFoundException(
              'Unable to retrieve the reviewed return request',
            );
          }

          // Record the review activity in the same transaction (SEC-14).
          const approved = data.status === 'approved';

          await this.activityLogsService.createLog(
            {
              actorId: adminId,
              action: approved
                ? 'ASSET_RETURN_APPROVED'
                : 'ASSET_RETURN_REJECTED',
              entityType: 'asset_return',
              entityId: savedRequest.id,
              description: `${savedRequest.reviewedBy?.name || 'Admin'} ${approved ? 'approved' : 'rejected'} the return request for ${savedRequest.asset?.name || 'an asset'} (${savedRequest.asset?.assetTag || 'unknown tag'}) submitted by ${savedRequest.requestedBy?.name || 'an employee'}.`,
              metadata: {
                returnRequestId: savedRequest.id,
                assetId: savedRequest.asset?.id,
                assetName: savedRequest.asset?.name,
                assetTag: savedRequest.asset?.assetTag,
                previousStatus: 'pending',
                newStatus: savedRequest.status,
                condition: savedRequest.condition,
                adminNote: savedRequest.adminNote,
                requestedBy: {
                  id: savedRequest.requestedBy?.id,
                  name: savedRequest.requestedBy?.name,
                },
                reviewedBy: {
                  id: adminId,
                  name: savedRequest.reviewedBy?.name,
                },
              },
            },
            manager,
          );

          return savedRequest;
        },
      );

    return returnRequest;
  }
}
