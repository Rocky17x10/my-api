
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from './asset.entity';
import { User } from '../users/user.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

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

  private async findAssignedUser(
    userId: number | string | null | undefined,
  ): Promise<User | null> {
    if (userId === null || userId === undefined || userId === '') {
      return null;
    }

    const id = Number(userId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid assigned user ID.');
    }

    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    return user;
  }

  async create(assetData: any): Promise<Asset> {
    const status = assetData.status ?? 'available';

    const assignedUser = await this.findAssignedUser(
      assetData.assignedTo,
    );

    if (status === 'assigned' && !assignedUser) {
      throw new BadRequestException(
        'Please assign a user before setting asset status to Assigned.',
      );
    }

    const { assignedTo, ...otherAssetData } = assetData;

    // Create one Asset object explicitly.
    const asset = new Asset();

    Object.assign(asset, otherAssetData);

    asset.assignedTo = assignedUser;

    return this.assetsRepository.save(asset);
  }

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

    const newStatus = assetData.status ?? asset.status;

    let assignedUser = asset.assignedTo;

    if (
      Object.prototype.hasOwnProperty.call(
        assetData,
        'assignedTo',
      )
    ) {
      assignedUser = await this.findAssignedUser(
        assetData.assignedTo,
      );
    }

    if (newStatus === 'assigned' && !assignedUser) {
      throw new BadRequestException(
        'Please assign a user before setting asset status to Assigned.',
      );
    }

    const { assignedTo, ...otherAssetData } = assetData;

    Object.assign(asset, otherAssetData);

    asset.assignedTo = assignedUser;

    return this.assetsRepository.save(asset);
  }
}
