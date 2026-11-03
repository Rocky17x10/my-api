import { Test, TestingModule } from '@nestjs/testing';
import { AssetRequestsService } from './asset-requests.service';

describe('AssetRequestsService', () => {
  let service: AssetRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssetRequestsService],
    }).compile();

    service = module.get<AssetRequestsService>(AssetRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
