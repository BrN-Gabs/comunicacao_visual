import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGazinImagesService } from './project-gazin-images.service';

describe('ProjectGazinImagesService', () => {
  let service: ProjectGazinImagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectGazinImagesService],
    }).compile();

    service = module.get<ProjectGazinImagesService>(ProjectGazinImagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
