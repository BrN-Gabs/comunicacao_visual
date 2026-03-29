import { Test, TestingModule } from '@nestjs/testing';
import { CityImagesController } from './city-images.controller';

describe('CityImagesController', () => {
  let controller: CityImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CityImagesController],
    }).compile();

    controller = module.get<CityImagesController>(CityImagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
