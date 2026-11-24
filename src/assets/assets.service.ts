
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { Asset } from './asset.entity';
import { AssetAssignmentHistory } from './asset-assignment-history.entity';
import { AssetReturn } from './asset-return.entity';
import { User } from '../users/user.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { AssetListQueryDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { Page, paginate } from '../common/pagination';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(AssetAssignmentHistory)
    private readonly historyRepository: Repository<AssetAssignmentHistory>,

    private readonly activityLogsService: ActivityLogsService,

    private readonly notificationsService: NotificationsService,
  ) {}

  // Get all assets
  findAll(query: AssetListQueryDto): Promise<Page<Asset>> {
    return this.listAssets(query);
  }

  // Get assets assigned to a specific employee
  findAssignedToUser(userId: number, query: AssetListQueryDto): Promise<Page<Asset>> {
    return this.listAssets(query, userId);
  }

  private listAssets(query: AssetListQueryDto, assigneeId?: number): Promise<Page<Asset>> {
    const builder = this.assetsRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.assignedTo', 'assignedTo');

    if (assigneeId !== undefined) {
      builder.andWhere('assignedTo.id = :assigneeId', { assigneeId });
    }

    if (query.status) {
      builder.andWhere('asset.status = :status', { status: query.status });
    }

    if (query.category) {
      builder.andWhere('asset.category = :category', { category: query.category });
    }

    if (query.search) {
      const columns = ['asset.assetTag', 'asset.name', 'asset.serialNumber', 'asset.brand', 'asset.model'];

      // The admin list also finds an asset by who holds it.
      if (assigneeId === undefined) {
        columns.push('assignedTo.name', 'assignedTo.email');
      }

      // LIKE is case-insensitive under the default *_ci collation.
      builder.andWhere(`(${columns.map((column) => `${column} LIKE :search`).join(' OR ')})`, {
        search: `%${query.search}%`,
      });
    }

    return paginate(builder, query, `asset.${query.sort}`);
  }

  // Get complete assignment history of an asset
  async findOne(id: number): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({
      where: { id },
      relations: { assignedTo: true },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found.`);
    }
    return asset;
  }

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

    // Employees read this too: the assigning admin is id + name only (SEC-13).
    return this.historyRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.asset', 'asset')
      .leftJoinAndSelect('history.assignedTo', 'assignedTo')
      .leftJoin('history.assignedBy', 'assignedBy')
      .addSelect(['assignedBy.id', 'assignedBy.name'])
      .where('assignedTo.id = :employeeId', { employeeId })
      .orderBy('history.id', 'DESC')
      .getMany();
  }

  // Create an asset and record activity
  async create(
    dto: CreateAssetDto,
    adminId: number,
  ): Promise<Asset> {
    const status = dto.status ?? 'available';

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

        Object.assign(asset, dto);

        asset.status = status;
        asset.assignedTo = null;

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        await this.activityLogsService.createLog(
          {
            actorId: admin.id,
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
          manager,
        );

        return savedAsset;
      },
    );
  }

  // Update an asset and record activity
  async update(
    id: number,
    dto: UpdateAssetDto,
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

        // The edit form sends the current status back, so only a change is checked.
        const newStatus = dto.status ?? asset.status;

        if (newStatus !== asset.status) {
          if (newStatus === 'assigned') {
            throw new BadRequestException(
              'Assigned status can only be set through the Assign API.',
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

          // SEC-10: the open maintenance record decides when the asset leaves maintenance.
          const underMaintenance = await manager.exists(Maintenance, {
            where: { asset: { id: asset.id }, status: 'in_progress' },
          });

          if (underMaintenance) {
            throw new ConflictException(
              'Complete the open maintenance record before changing the status.',
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

        Object.assign(asset, dto);
        asset.status = newStatus;

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        await this.activityLogsService.createLog(
          {
            actorId: admin.id,
            action: 'ASSET_UPDATED',
            entityType: 'asset',
            entityId: savedAsset.id,
            description: `${admin.name} updated asset ${savedAsset.name} (${savedAsset.assetTag}).`,
            metadata: {
              assetTag: savedAsset.assetTag,
              assetName: savedAsset.name,
              previousValues,
              updatedValues: dto,
              updatedById: admin.id,
              updatedByName: admin.name,
            },
          },
          manager,
        );

        return savedAsset;
      },
    );
  }

  // Assign an available asset, record history,
  // notify the employee, and record activity.
  async assignAsset(
    assetId: number,
    employeeId: number,
    adminId: number,
  ): Promise<Asset> {
    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      throw new BadRequestException(
        'Invalid employee ID.',
      );
    }

    // Separation of duties (D3): an administrator's own equipment is handed out by another one.
    if (employeeId === adminId) {
      throw new ForbiddenException(
        'You cannot assign an asset to yourself. Ask another administrator.',
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

        if (!employee.isActive) {
          throw new BadRequestException('This account is deactivated.');
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

        await this.notificationsService.createNotification(
          employee.id,
          'Asset Assigned',
          `${asset.name} (${asset.assetTag}) has been assigned to you.`,
          'asset_assigned',
          asset.id,
          manager,
        );

        await this.activityLogsService.createLog(
          {
            actorId: admin.id,
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
          manager,
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

        // A pending return for this assignment can no longer be approved: close it.
        const closedReturns = await manager
          .createQueryBuilder()
          .update(AssetReturn)
          .set({
            status: 'rejected',
            reviewedBy: { id: admin.id },
            reviewedAt: returnDate,
            adminNote: 'Closed automatically: the asset was unassigned.',
          })
          .where('assignment_history_id = :historyId AND status = :pending', {
            historyId: history.id,
            pending: 'pending',
          })
          .execute();

        asset.assignedTo = null;
        asset.status = 'available';

        const savedAsset = await manager.save(
          Asset,
          asset,
        );

        // Record asset unassignment activity
        await this.activityLogsService.createLog(
          {
            actorId: admin.id,
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
              // Pending return requests closed by this unassignment (audit trail).
              closedPendingReturns: closedReturns.affected ?? 0,
            },
          },
          manager,
        );

        return savedAsset;
      },
    );
  }
}
