
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';

import {
  AssetRequest,
  AssetRequestStatus,
} from '../asset-requests/asset-request.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(AssetRequest)
    private readonly requestRepository: Repository<AssetRequest>,
  ) {}

  async getStatistics() {
    const [
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      retiredAssets,
      totalEmployees,
      pendingRequests,
      departmentStatistics,
    ] = await Promise.all([
      this.assetRepository.count(),

      this.assetRepository.count({
        where: { status: 'available' },
      }),

      this.assetRepository.count({
        where: { status: 'assigned' },
      }),

      this.assetRepository.count({
        where: { status: 'maintenance' },
      }),

      this.assetRepository.count({
        where: { status: 'retired' },
      }),

      // Count regular employees only
      this.userRepository.count({
        where: { role: 'user' },
      }),

      // Count pending asset requests
      this.requestRepository.count({
        where: {
          status: AssetRequestStatus.PENDING,
        },
      }),

      // Department-wise asset statistics
      this.assetRepository
        .createQueryBuilder('asset')
        .select(
          "COALESCE(NULLIF(TRIM(asset.department), ''), 'Unspecified')",
          'department',
        )
        .addSelect('COUNT(asset.id)', 'totalAssets')
        .groupBy('department')
        .orderBy('COUNT(asset.id)', 'DESC')
        .getRawMany(),
    ]);

    return {
      summary: {
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        totalEmployees,
        pendingRequests,
      },

      departmentStatistics: departmentStatistics.map((item) => ({
        department: item.department,
        totalAssets: Number(item.totalAssets),
      })),
    };
  }
}
