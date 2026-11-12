
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Maintenance } from './maintenance.entity';
import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';

import {
  CreateMaintenanceDto,
  CompleteMaintenanceDto,
} from './maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,

    private readonly dataSource: DataSource,

    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async create(dto: CreateMaintenanceDto, userId: number) {
    const result = await this.dataSource.transaction(async (manager) => {
      const assetRepository = manager.getRepository(Asset);
      const maintenanceRepository = manager.getRepository(Maintenance);

      const asset = await assetRepository.findOne({
        where: { id: dto.assetId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }

      if (asset.status === 'assigned') {
        throw new BadRequestException(
          'An assigned asset cannot be sent for maintenance',
        );
      }

      if (asset.status === 'retired') {
        throw new BadRequestException(
          'A retired asset cannot be sent for maintenance',
        );
      }

      const existingMaintenance = await maintenanceRepository.findOne({
        where: {
          asset: { id: asset.id },
          status: 'in_progress',
        },
      });

      if (existingMaintenance) {
        throw new ConflictException(
          'This asset already has an active maintenance record',
        );
      }

      const maintenance = maintenanceRepository.create({
        asset,
        createdBy: { id: userId } as User,
        completedBy: null,
        maintenanceType: dto.maintenanceType.trim(),
        problemDescription: dto.problemDescription.trim(),
        repairDetails: null,
        startDate: new Date(),
        completionDate: null,
        cost: 0,
        serviceProvider: dto.serviceProvider?.trim() || null,
        status: 'in_progress',
        adminNotes: dto.adminNotes?.trim() || null,
      });

      asset.status = 'maintenance';
      await assetRepository.save(asset);

      const saved = await maintenanceRepository.save(maintenance);

      const record = await maintenanceRepository.findOne({
        where: { id: saved.id },
        relations: {
          asset: true,
          createdBy: true,
          completedBy: true,
        },
      });

      if (!record) {
        throw new NotFoundException('Maintenance record not found');
      }

      return record;
    });

    // Record maintenance creation
    await this.activityLogsService.createLog({
      actorId: userId,
      action: 'MAINTENANCE_CREATED',
      entityType: 'maintenance',
      entityId: result.id,
      description: `Maintenance record created for ${result.asset.name} (${result.asset.assetTag}).`,
      metadata: {
        maintenanceId: result.id,
        assetId: result.asset.id,
        assetName: result.asset.name,
        assetTag: result.asset.assetTag,
        maintenanceType: result.maintenanceType,
        problemDescription: result.problemDescription,
        status: result.status,
      },
    });

    return result;
  }

  async findAll() {
    return this.maintenanceRepository.find({
      relations: {
        asset: true,
        createdBy: true,
        completedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: {
        asset: true,
        createdBy: true,
        completedBy: true,
      },
    });

    if (!maintenance) {
      throw new NotFoundException('Maintenance record not found');
    }

    return maintenance;
  }

  async findByAsset(assetId: number) {
    const asset = await this.dataSource
      .getRepository(Asset)
      .findOne({ where: { id: assetId } });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return this.maintenanceRepository.find({
      where: { asset: { id: assetId } },
      relations: {
        asset: true,
        createdBy: true,
        completedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async complete(
    id: number,
    dto: CompleteMaintenanceDto,
    userId: number,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const maintenanceRepository = manager.getRepository(Maintenance);
      const assetRepository = manager.getRepository(Asset);

      const maintenance = await maintenanceRepository.findOne({
        where: { id },
        relations: { asset: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!maintenance) {
        throw new NotFoundException('Maintenance record not found');
      }

      if (maintenance.status === 'completed') {
        throw new ConflictException(
          'This maintenance record has already been completed',
        );
      }

      const asset = await assetRepository.findOne({
        where: { id: maintenance.asset.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!asset) {
        throw new NotFoundException('Associated asset not found');
      }

      const previousValues = {
        status: maintenance.status,
        repairDetails: maintenance.repairDetails,
        cost: maintenance.cost,
        serviceProvider: maintenance.serviceProvider,
        adminNotes: maintenance.adminNotes,
      };

      maintenance.repairDetails =
        dto.repairDetails?.trim() || maintenance.repairDetails;

      maintenance.cost = dto.cost ?? maintenance.cost;

      maintenance.serviceProvider =
        dto.serviceProvider?.trim() || maintenance.serviceProvider;

      maintenance.adminNotes =
        dto.adminNotes?.trim() || maintenance.adminNotes;

      maintenance.completedBy = { id: userId } as User;
      maintenance.completionDate = new Date();
      maintenance.status = 'completed';

      asset.status = 'available';

      await assetRepository.save(asset);
      await maintenanceRepository.save(maintenance);

      const record = await maintenanceRepository.findOne({
        where: { id },
        relations: {
          asset: true,
          createdBy: true,
          completedBy: true,
        },
      });

      if (!record) {
        throw new NotFoundException('Maintenance record not found');
      }

      return {
        record,
        previousValues,
      };
    });

    const record = result.record;

    // Record maintenance detail updates
    await this.activityLogsService.createLog({
      actorId: userId,
      action: 'MAINTENANCE_UPDATED',
      entityType: 'maintenance',
      entityId: record.id,
      description: `Maintenance details updated for ${record.asset.name} (${record.asset.assetTag}).`,
      metadata: {
        previousValues: result.previousValues,
        updatedValues: {
          repairDetails: record.repairDetails,
          cost: record.cost,
          serviceProvider: record.serviceProvider,
          adminNotes: record.adminNotes,
        },
      },
    });

    // Record maintenance status change
    await this.activityLogsService.createLog({
      actorId: userId,
      action: 'MAINTENANCE_STATUS_CHANGED',
      entityType: 'maintenance',
      entityId: record.id,
      description: `Maintenance for ${record.asset.name} (${record.asset.assetTag}) changed from in_progress to completed.`,
      metadata: {
        previousStatus: result.previousValues.status,
        newStatus: record.status,
        assetId: record.asset.id,
        assetName: record.asset.name,
        assetPreviousStatus: 'maintenance',
        assetNewStatus: 'available',
      },
    });

    return record;
  }
}
