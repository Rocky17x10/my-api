
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

  // Create an asset
  async create(assetData: any): Promise<Asset> {
    // Assignment must use the dedicated Assign API
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

    const asset = new Asset();

    Object.assign(asset, assetData);

    asset.status = status;
    asset.assignedTo = null;

    return this.assetsRepository.save(asset);
  }

  // Update an asset
  async update(
    id: number,
    assetData: any,
  ): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({
      where: { id },
      relations: {
        assignedTo: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `Asset with ID ${id} not found.`,
      );
    }

    // Assignment changes must use the dedicated Assign/Unassign APIs
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

    // Prevent directly setting Assigned status
    if (assetData.status === 'assigned') {
      throw new BadRequestException(
        'Assigned status can only be set through the Assign API.',
      );
    }

    // Validate a requested status change
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

      if (asset.assignedTo || asset.status === 'assigned') {
        throw new BadRequestException(
          'Please unassign this asset before changing its status.',
        );
      }
    }

    // Preserve existing asset assignment information
    const { assignedTo, ...otherAssetData } = assetData;

    Object.assign(asset, otherAssetData);

    return this.assetsRepository.save(asset);
  }

  // Assign an available asset and create its history record
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

        return asset;
      },
    );
  }

  // Unassign an asset and record its return date
  async unassignAsset(
    assetId: number,
  ): Promise<Asset> {
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

        history.returnedAt = new Date();

        await manager.save(
          AssetAssignmentHistory,
          history,
        );

        asset.assignedTo = null;
        asset.status = 'available';

        return manager.save(Asset, asset);
      },
    );
  }
}
