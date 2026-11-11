
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';
import { AssetAssignmentHistory } from '../assets/asset-assignment-history.entity';
import { Maintenance } from '../maintenance/maintenance.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(AssetAssignmentHistory)
    private readonly historyRepository: Repository<AssetAssignmentHistory>,

    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,
  ) {}

  // 1. Complete Asset Report
  async getAssets(query: Record<string, string>) {
    const qb = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.assignedTo', 'assignedTo')
      .orderBy('asset.id', 'DESC');

    if (query.status) {
      qb.andWhere('asset.status = :status', {
        status: query.status,
      });
    }

    if (query.department) {
      qb.andWhere('asset.department = :department', {
        department: query.department,
      });
    }

    if (query.employeeId) {
      qb.andWhere('assignedTo.id = :employeeId', {
        employeeId: Number(query.employeeId),
      });
    }

    if (query.search) {
      qb.andWhere(
        `(
          asset.assetTag LIKE :search OR
          asset.name LIKE :search OR
          asset.category LIKE :search OR
          asset.brand LIKE :search OR
          asset.model LIKE :search OR
          assignedTo.name LIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }

    if (query.from) {
      qb.andWhere('asset.createdAt >= :from', {
        from: query.from,
      });
    }

    if (query.to) {
      qb.andWhere('asset.createdAt <= :to', {
        to: `${query.to} 23:59:59`,
      });
    }

    return qb.getMany();
  }

  // 2. Employee-wise Asset Report
  async getEmployees() {
    const employees = await this.userRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: 'user' })
      .orderBy('user.name', 'ASC')
      .getMany();

    const assets = await this.assetRepository.find({
      relations: {
        assignedTo: true,
      },
      order: { id: 'DESC' },
    });

    return employees.map((employee) => {
      const assignedAssets = assets.filter(
        (asset) => asset.assignedTo?.id === employee.id,
      );

      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        assignedAssetCount: assignedAssets.length,
        assignedAssets,
      };
    });
  }

  // 3. Department-wise Asset Report
  async getDepartments() {
    const assets = await this.assetRepository.find({
      relations: {
        assignedTo: true,
      },
    });

    const employees = await this.userRepository.find({
      where: { role: 'user' },
    });

    const departmentNames = new Set<string>();

    assets.forEach((asset) => {
      if (asset.department) {
        departmentNames.add(asset.department);
      }
    });

    employees.forEach((employee) => {
      if (employee.department) {
        departmentNames.add(employee.department);
      }
    });

    return Array.from(departmentNames)
      .sort()
      .map((department) => {
        const departmentAssets = assets.filter(
          (asset) => asset.department === department,
        );

        const departmentEmployees = employees.filter(
          (employee) => employee.department === department,
        );

        return {
          department,
          totalAssets: departmentAssets.length,
          assignedAssets: departmentAssets.filter(
            (asset) => asset.status === 'assigned',
          ).length,
          availableAssets: departmentAssets.filter(
            (asset) => asset.status === 'available',
          ).length,
          maintenanceAssets: departmentAssets.filter(
            (asset) => asset.status === 'maintenance',
          ).length,
          retiredAssets: departmentAssets.filter(
            (asset) => asset.status === 'retired',
          ).length,
          totalEmployees: departmentEmployees.length,
        };
      });
  }

  // 4. Assigned Asset Report
  async getAssignedAssets(query: Record<string, string>) {
    const qb = this.assetRepository
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.assignedTo', 'assignedTo')
      .where('asset.status = :status', { status: 'assigned' })
      .orderBy('asset.id', 'DESC');

    if (query.employeeId) {
      qb.andWhere('assignedTo.id = :employeeId', {
        employeeId: Number(query.employeeId),
      });
    }

    if (query.department) {
      qb.andWhere('asset.department = :department', {
        department: query.department,
      });
    }

    if (query.search) {
      qb.andWhere(
        `(asset.assetTag LIKE :search OR asset.name LIKE :search OR assignedTo.name LIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  // 5. Available Asset Report
  async getAvailableAssets(query: Record<string, string>) {
    const qb = this.assetRepository
      .createQueryBuilder('asset')
      .where('asset.status = :status', { status: 'available' })
      .orderBy('asset.id', 'DESC');

    if (query.department) {
      qb.andWhere('asset.department = :department', {
        department: query.department,
      });
    }

    if (query.search) {
      qb.andWhere(
        `(asset.assetTag LIKE :search OR asset.name LIKE :search OR asset.category LIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  // 6. Maintenance Report
  async getMaintenance(query: Record<string, string>) {
    const qb = this.maintenanceRepository
      .createQueryBuilder('maintenance')
      .leftJoinAndSelect('maintenance.asset', 'asset')
      .leftJoinAndSelect('maintenance.createdBy', 'createdBy')
      .leftJoinAndSelect('maintenance.completedBy', 'completedBy')
      .orderBy('maintenance.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('maintenance.status = :status', {
        status: query.status,
      });
    }

    if (query.from) {
      qb.andWhere('maintenance.startDate >= :from', {
        from: query.from,
      });
    }

    if (query.to) {
      qb.andWhere('maintenance.startDate <= :to', {
        to: `${query.to} 23:59:59`,
      });
    }

    if (query.search) {
      qb.andWhere(
        `(
          asset.assetTag LIKE :search OR
          asset.name LIKE :search OR
          maintenance.problemDescription LIKE :search
        )`,
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  // 7. Asset Assignment History Report
  async getAssignmentHistory() {
    return this.historyRepository.find({
      relations: {
        asset: true,
        assignedTo: true,
        assignedBy: true,
      },
      order: { assignedAt: 'DESC' },
    });
  }
}
