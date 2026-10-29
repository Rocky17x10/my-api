
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
  ) {}

  findAll(): Promise<Asset[]> {
    return this.assetsRepository.find({
      order: { id: 'DESC' },
    });
  }

  create(assetData: Partial<Asset>): Promise<Asset> {
    const asset = this.assetsRepository.create(assetData);
    return this.assetsRepository.save(asset);
  }
}
