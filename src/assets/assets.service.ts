
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { Asset } from './asset.entity';
import { AssetAssignmentHistory } from './asset-assignment-history.entity';
import { User } from '../users/user.entity';
import { Notification } from '../support-tickets/notification.entity';
import { ActivityLog } from '../activity-logs/activity-log.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(AssetAssignmentHistory)
    private readonly historyRepository: Repository<AssetAssignmentHistory>,
  ) {}

  // Get all assets
  async findAll(): Promise<Asset[]> {
    return this.assetsRepository.find({
      relations: {
        assignedTo: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // Get assets assigned to a specific employee
  async findAssignedToUser(userId: number): Promise<Asset[]> {
    return this.assetsRepository.find({
      where: {
        assignedTo: {
          id: userId,
        },
      },
      relations: {
        assignedTo: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // Get complete assignment history of an asset
  async findAssetHistory(
    assetId: number,
  ): Promise<AssetAssignmentHistory[]> {
    const asset = await this.assetsRepository.findOneBy({
      id: assetId,
    });

    if (!asset) {
      throw new NotFoundException(
        `Asset with ID ${assetId} not found.`,
      );
    }

    return this.historyRepository.find({
      where: {
        asset: {
          id: assetId,
        },
      },
      relations: {
        asset: true,
        assignedTo: true,
        assignedBy: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // Get complete assignment history of an employee
  async findEmployeeHistory(
    employeeId: number,
  ): Promise<AssetAssignmentHistory[]> {
    const employee = await this.usersRepository.findOneBy({
      id: employeeId,
    });

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${employeeId} not found.`,
      );
    }

    return this.historyRepository.find({
      where: {
        assignedTo: {
          id: employeeId,
        },
      },
      relations: {
        asset: true,
        assignedTo: true,
        assignedBy: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // Create an asset and record activity
  async create(
    assetData: any,
    adminId: number,
  ): Promise<Asset> {
    if (
      Object.prototype.hasOwnProperty.call(
        assetData,
        'assignedTo',
      )
    ) {
      throw new BadRequestException(
        'Assets cannot be assigned during creation. Use the Assign API.',
      );
    }

    const status = assetData.status ?? 'available';

    if (status === 'assigned') {
      throw new BadRequestException(
        'Assets cannot be created with Assigned status. Use the Assign API.',
      );
    }

    if (
      !['available', 'maintenance', 'retired'].includes(status)
    ) {
      throw new BadRequestException(
        'Invalid asset status.',
      );
    }

    if (
      !Number.isInteger(adminId) ||
      adminId <= 0
    ) {
      throw new BadRequestException(
        'Invalid administrator ID.',
      );
    }

    return this.assetsRepository.manager.transaction(
      async (manager) => {
        const admin = await manager.findOneBy(
          User,
          { id: adminId },
        );

        if (!admin) {
          throw new NotFoundException(
            `Administrator with ID ${adminId} not found.`,
          );
        }

        const asset = new Asset();

        Object.assign(asset, assetData);

        asset.status = status;
        asset.assignedTo = null;

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        const activityLog = manager.create(
          ActivityLog,
          {
            actor: admin,
            action: 'ASSET_CREATED',
            entityType: 'asset',
            entityId: savedAsset.id,
            description: `${admin.name} created asset ${savedAsset.name} (${savedAsset.assetTag}).`,
            metadata: {
              assetId: savedAsset.id,
              assetTag: savedAsset.assetTag,
              assetName: savedAsset.name,
              category: savedAsset.category,
              status: savedAsset.status,
              createdById: admin.id,
              createdByName: admin.name,
            },
          },
        );

        await manager.save(
          ActivityLog,
          activityLog,
        );

        return savedAsset;
      },
    );
  }

  // Update an asset and record activity
  async update(
    id: number,
    assetData: any,
    adminId: number,
  ): Promise<Asset> {
    if (
      !Number.isInteger(adminId) ||
      adminId <= 0
    ) {
      throw new BadRequestException(
        'Invalid administrator ID.',
      );
    }

    return this.assetsRepository.manager.transaction(
      async (manager) => {
        const asset = await manager.findOne(Asset, {
          where: { id },
          relations: {
            assignedTo: true,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!asset) {
          throw new NotFoundException(
            `Asset with ID ${id} not found.`,
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(
            assetData,
            'assignedTo',
          )
        ) {
          throw new BadRequestException(
            'Assigned employee cannot be changed through asset editing. Use the Assign or Unassign API.',
          );
        }

        if (assetData.status === 'assigned') {
          throw new BadRequestException(
            'Assigned status can only be set through the Assign API.',
          );
        }

        if (
          Object.prototype.hasOwnProperty.call(
            assetData,
            'status',
          )
        ) {
          if (
            !['available', 'maintenance', 'retired'].includes(
              assetData.status,
            )
          ) {
            throw new BadRequestException(
              'Invalid asset status.',
            );
          }

          if (
            asset.assignedTo ||
            asset.status === 'assigned'
          ) {
            throw new BadRequestException(
              'Please unassign this asset before changing its status.',
            );
          }
        }

        const admin = await manager.findOneBy(
          User,
          { id: adminId },
        );

        if (!admin) {
          throw new NotFoundException(
            `Administrator with ID ${adminId} not found.`,
          );
        }

        const previousValues = {
          name: asset.name,
          category: asset.category,
          brand: asset.brand,
          model: asset.model,
          status: asset.status,
          location: asset.location,
          department: asset.department,
        };

        const { assignedTo, ...otherAssetData } = assetData;

        Object.assign(asset, otherAssetData);

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        const activityLog = manager.create(
          ActivityLog,
          {
            actor: admin,
            action: 'ASSET_UPDATED',
            entityType: 'asset',
            entityId: savedAsset.id,
            description: `${admin.name} updated asset ${savedAsset.name} (${savedAsset.assetTag}).`,
            metadata: {
              assetTag: savedAsset.assetTag,
              assetName: savedAsset.name,
              previousValues,
              updatedValues: assetData,
              updatedById: admin.id,
              updatedByName: admin.name,
            },
          },
        );

        await manager.save(
          ActivityLog,
          activityLog,
        );

        return savedAsset;
      },
    );
  }

  // Assign an available asset, record history,
  // notify the employee, and record activity.
  async assignAsset(
    assetId: number,
    userId: number | string,
    adminId: number,
  ): Promise<Asset> {
    const employeeId = Number(userId);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      throw new BadRequestException(
        'Invalid employee ID.',
      );
    }

    if (
      !Number.isInteger(adminId) ||
      adminId <= 0
    ) {
      throw new BadRequestException(
        'Invalid administrator ID.',
      );
    }

    return this.assetsRepository.manager.transaction(
      async (manager) => {
        const asset = await manager.findOne(Asset, {
          where: { id: assetId },
          relations: {
            assignedTo: true,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!asset) {
          throw new NotFoundException(
            `Asset with ID ${assetId} not found.`,
          );
        }

        if (
          asset.status !== 'available' ||
          asset.assignedTo !== null
        ) {
          throw new ConflictException(
            'This asset is not available for assignment.',
          );
        }

        const employee = await manager.findOneBy(
          User,
          { id: employeeId },
        );

        if (!employee) {
          throw new NotFoundException(
            `Employee with ID ${employeeId} not found.`,
          );
        }

        const admin = await manager.findOneBy(
          User,
          { id: adminId },
        );

        if (!admin) {
          throw new NotFoundException(
            `Administrator with ID ${adminId} not found.`,
          );
        }

        asset.assignedTo = employee;
        asset.status = 'assigned';

        await manager.save(Asset, asset);

        const history = manager.create(
          AssetAssignmentHistory,
          {
            asset,
            assignedTo: employee,
            assignedBy: admin,
            returnedAt: null,
          },
        );

        await manager.save(
          AssetAssignmentHistory,
          history,
        );

        const notification = manager.create(
          Notification,
          {
            recipient: employee,
            ticket: null,
            referenceId: asset.id,
            title: 'Asset Assigned',
            message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
            type: 'asset_assigned',
            isRead: false,
          },
        );

        await manager.save(
          Notification,
          notification,
        );

        const activityLog = manager.create(
          ActivityLog,
          {
            actor: admin,
            action: 'ASSET_ASSIGNED',
            entityType: 'asset',
            entityId: asset.id,
            description: `${admin.name} assigned ${asset.name} (${asset.assetTag}) to ${employee.name}.`,
            metadata: {
              assetTag: asset.assetTag,
              assetName: asset.name,
              assignedToId: employee.id,
              assignedToName: employee.name,
              assignedById: admin.id,
              assignedByName: admin.name,
            },
          },
        );

        await manager.save(
          ActivityLog,
          activityLog,
        );

        return asset;
      },
    );
  }

  // Unassign an asset and record activity
  async unassignAsset(
    assetId: number,
    adminId: number,
  ): Promise<Asset> {
    if (
      !Number.isInteger(adminId) ||
      adminId <= 0
    ) {
      throw new BadRequestException(
        'Invalid administrator ID.',
      );
    }

    return this.assetsRepository.manager.transaction(
      async (manager) => {
        const asset = await manager.findOne(Asset, {
          where: { id: assetId },
          relations: {
            assignedTo: true,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!asset) {
          throw new NotFoundException(
            `Asset with ID ${assetId} not found.`,
          );
        }

        if (
          asset.status !== 'assigned' ||
          !asset.assignedTo
        ) {
          throw new BadRequestException(
            'This asset is not currently assigned.',
          );
        }

        const employee = asset.assignedTo;

        const admin = await manager.findOneBy(
          User,
          { id: adminId },
        );

        if (!admin) {
          throw new NotFoundException(
            `Administrator with ID ${adminId} not found.`,
          );
        }

        const history = await manager.findOne(
          AssetAssignmentHistory,
          {
            where: {
              asset: {
                id: assetId,
              },
              returnedAt: IsNull(),
            },
            order: {
              id: 'DESC',
            },
            lock: {
              mode: 'pessimistic_write',
            },
          },
        );

        if (!history) {
          throw new BadRequestException(
            'No active assignment history found for this asset.',
          );
        }

        const returnDate = new Date();

        history.returnedAt = returnDate;

        await manager.save(
          AssetAssignmentHistory,
          history,
        );

        asset.assignedTo = null;
        asset.status = 'available';

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        // Record asset unassignment activity
        const activityLog = manager.create(
          ActivityLog,
          {
            actor: admin,
            action: 'ASSET_UNASSIGNED',
            entityType: 'asset',
            entityId: savedAsset.id,
            description: `${admin.name} unassigned ${savedAsset.name} (${savedAsset.assetTag}) from ${employee.name}.`,
            metadata: {
              assetId: savedAsset.id,
              assetTag: savedAsset.assetTag,
              assetName: savedAsset.name,
              previousEmployeeId: employee.id,
              previousEmployeeName: employee.name,
              unassignedById: admin.id,
              unassignedByName: admin.name,
              returnedAt: returnDate.toISOString(),
            },
          },
        );

        await manager.save(
          ActivityLog,
          activityLog,
        );

        return savedAsset;
      },
    );
  }
}
