import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { deletePhysicalFileFromUrl } from '../common/upload/file-storage.utils';
import { GazinLibraryService } from './gazin-library.service';

jest.mock('../common/upload/file-storage.utils', () => ({
  deletePhysicalFileFromUrl: jest.fn(),
}));

describe('GazinLibraryService', () => {
  let service: GazinLibraryService;

  const prisma = {
    gazinLibraryImage: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    projectGazinImage: {
      count: jest.fn(),
    },
  };

  const auditLogsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GazinLibraryService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
      ],
    }).compile();

    service = module.get<GazinLibraryService>(GazinLibraryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should remove an unused library image', async () => {
    prisma.gazinLibraryImage.findUnique.mockResolvedValue({
      id: 'image-1',
      title: 'Banner',
      description: 'Imagem principal',
      imageUrl: '/uploads/gazin-library/banner.png',
      status: 'ACTIVE',
    });
    prisma.projectGazinImage.count.mockResolvedValue(0);
    prisma.gazinLibraryImage.delete.mockResolvedValue(undefined);

    await expect(service.remove('image-1', 'user-1')).resolves.toEqual({
      message: 'Imagem da Gazin removida com sucesso',
    });

    expect(prisma.projectGazinImage.count).toHaveBeenCalledWith({
      where: {
        gazinLibraryImageId: 'image-1',
      },
    });
    expect(prisma.gazinLibraryImage.delete).toHaveBeenCalledWith({
      where: { id: 'image-1' },
    });
    expect(deletePhysicalFileFromUrl).toHaveBeenCalledWith(
      '/uploads/gazin-library/banner.png',
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entityId: 'image-1',
        entityLabel: 'Banner',
      }),
    );
  });

  it('should reject deletion when the image is already linked to communications', async () => {
    prisma.gazinLibraryImage.findUnique.mockResolvedValue({
      id: 'image-1',
      title: 'Banner',
      description: 'Imagem principal',
      imageUrl: '/uploads/gazin-library/banner.png',
      status: 'ACTIVE',
    });
    prisma.projectGazinImage.count.mockResolvedValue(2);

    await expect(service.remove('image-1', 'user-1')).rejects.toThrow(
      'Nao e possivel excluir a imagem da Gazin porque ela ja esta vinculada a 2 comunicacoes visuais. Inative a imagem para impedir novos usos.',
    );

    expect(prisma.gazinLibraryImage.delete).not.toHaveBeenCalled();
    expect(deletePhysicalFileFromUrl).not.toHaveBeenCalled();
    expect(auditLogsService.create).not.toHaveBeenCalled();
  });
});
