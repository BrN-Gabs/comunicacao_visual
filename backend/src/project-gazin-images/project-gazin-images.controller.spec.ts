import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGazinImagesController } from './project-gazin-images.controller';

describe('ProjectGazinImagesController', () => {
  let controller: ProjectGazinImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectGazinImagesController],
    }).compile();

    controller = module.get<ProjectGazinImagesController>(
      ProjectGazinImagesController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
