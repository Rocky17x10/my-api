
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
} from 'typeorm';

import { AssetReturn } from '../assets/asset-return.entity';
import { Asset } from '../assets/asset.entity';
import { AssetAssignmentHistory } from '../assets/asset-assignment-history.entity';
import { User } from '../users/user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

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

          return returnRepo.save(newReturnRequest);
        },
      );

    // Record the activity after the return request is successfully saved.
    await this.activityLogsService.createLog({
      actorId: userId,
      action: 'ASSET_RETURN_REQUESTED',
      entityType: 'asset_return',
      entityId: returnRequest.id,
      description: `${returnRequest.requestedBy?.name || 'Employee'} requested to return ${returnRequest.asset?.name || 'an asset'} (${returnRequest.asset?.assetTag || 'unknown tag'}).`,
      metadata: {
        returnRequestId: returnRequest.id,
        assetId,
        assetName: returnRequest.asset?.name,
        assetTag: returnRequest.asset?.assetTag,
        employeeNote: returnRequest.employeeNote,
        status: returnRequest.status,
        requestedBy: {
          id: userId,
          name: returnRequest.requestedBy?.name,
        },
      },
    });

    return returnRequest;
  }

  // EMPLOYEE: View own return requests
  async findMyReturns(userId: number) {
    return this.assetReturnRepository.find({
      where: {
        requestedBy: { id: userId },
      },
      relations: {
        asset: true,
        assignmentHistory: true,
        requestedBy: true,
        reviewedBy: true,
      },
      order: {
        requestedAt: 'DESC',
      },
    });
  }

  // ADMIN: View all return requests
  async findAllReturns() {
    return this.assetReturnRepository.find({
      relations: {
        asset: true,
        assignmentHistory: true,
        requestedBy: true,
        reviewedBy: true,
      },
      order: {
        requestedAt: 'DESC',
      },
    });
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
            asset.assignedTo = null as any;

            asset.status =
              data.condition === 'good'
                ? 'available'
                : 'maintenance';

            await assetRepo.save(asset);

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

          return savedRequest;
        },
      );

    // Record the review activity after the transaction succeeds.
    const approved = data.status === 'approved';

    await this.activityLogsService.createLog({
      actorId: adminId,
      action: approved
        ? 'ASSET_RETURN_APPROVED'
        : 'ASSET_RETURN_REJECTED',
      entityType: 'asset_return',
      entityId: returnRequest.id,
      description: `${returnRequest.reviewedBy?.name || 'Admin'} ${approved ? 'approved' : 'rejected'} the return request for ${returnRequest.asset?.name || 'an asset'} (${returnRequest.asset?.assetTag || 'unknown tag'}) submitted by ${returnRequest.requestedBy?.name || 'an employee'}.`,
      metadata: {
        returnRequestId: returnRequest.id,
        assetId: returnRequest.asset?.id,
        assetName: returnRequest.asset?.name,
        assetTag: returnRequest.asset?.assetTag,
        previousStatus: 'pending',
        newStatus: returnRequest.status,
        condition: returnRequest.condition,
        adminNote: returnRequest.adminNote,
        requestedBy: {
          id: returnRequest.requestedBy?.id,
          name: returnRequest.requestedBy?.name,
        },
        reviewedBy: {
          id: adminId,
          name: returnRequest.reviewedBy?.name,
        },
      },
    });

    return returnRequest;
  }
}
