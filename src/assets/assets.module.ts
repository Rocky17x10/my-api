import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './asset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset])],
  providers: [AssetsService],
  controllers: [AssetsController],
})
export class AssetsModule {}
