import { Test, TestingModule } from '@nestjs/testing';
import { AssetRequestsController } from './asset-requests.controller';
import { AssetRequestsService } from './asset-requests.service';

describe('AssetRequestsController', () => {
  let controller: AssetRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetRequestsController],
      providers: [
        { provide: AssetRequestsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AssetRequestsController>(AssetRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
