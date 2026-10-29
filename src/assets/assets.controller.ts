import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { AssetsService } from './assets.service';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Post()
  create(@Body() assetData: any) {
    return this.assetsService.create(assetData);
  }
}