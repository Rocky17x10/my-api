import { Test, TestingModule } from '@nestjs/testing';
import { AssetRequestsController } from './asset-requests.controller';

describe('AssetRequestsController', () => {
  let controller: AssetRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetRequestsController],
    }).compile();

    controller = module.get<AssetRequestsController>(AssetRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
