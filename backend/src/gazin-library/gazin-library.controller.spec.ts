import { Test, TestingModule } from '@nestjs/testing';
import { GazinLibraryController } from './gazin-library.controller';
import { GazinLibraryService } from './gazin-library.service';

describe('GazinLibraryController', () => {
  let controller: GazinLibraryController;

  const gazinLibraryService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GazinLibraryController],
      providers: [
        {
          provide: GazinLibraryService,
          useValue: gazinLibraryService,
        },
      ],
    }).compile();

    controller = module.get<GazinLibraryController>(GazinLibraryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
