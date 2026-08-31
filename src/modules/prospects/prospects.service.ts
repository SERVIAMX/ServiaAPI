import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientsService } from '../clients/clients.service';
import { Client } from '../clients/entities/client.entity';
import { S3_PROSPECTS_FOLDER } from '../../common/constants/customer-upload.constants';
import { ProspectEstatus } from '../../common/enums/prospect-estatus.enum';
import { S3Service } from '../s3/s3.service';
import { ConvertProspectDto } from './dto/convert-prospect.dto';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { FilterProspectDto } from './dto/filter-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
import { Prospect } from './entities/prospect.entity';

@Injectable()
export class ProspectsService {
  constructor(
    @InjectRepository(Prospect)
    private readonly prospectRepository: Repository<Prospect>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly clientsService: ClientsService,
    private readonly s3Service: S3Service,
  ) {}

  private async uploadProspectLogo(
    logo: Express.Multer.File | undefined,
  ): Promise<string | null> {
    if (!logo) return null;
    const { url } = await this.s3Service.uploadFile(logo, S3_PROSPECTS_FOLDER);
    return url;
  }

  private async assertClientDoesNotExist(prospect: Prospect): Promise<void> {
    const byEmail = await this.clientRepository.findOne({
      where: { email: prospect.email },
    });
    if (byEmail && !byEmail.deletedAt) {
      throw new BadRequestException(
        'Ya existe un cliente registrado con el mismo email',
      );
    }

    if (prospect.rfc) {
      const byRfc = await this.clientRepository.findOne({
        where: { rfc: prospect.rfc },
      });
      if (byRfc && !byRfc.deletedAt) {
        throw new BadRequestException(
          'Ya existe un cliente registrado con el mismo RFC',
        );
      }
    }
  }

  async create(dto: CreateProspectDto, logo?: Express.Multer.File) {
    const { logoUrl: _omitLogoUrl, estatus: _omitEstatus, ...prospectDto } = dto;

    const prospect = this.prospectRepository.create({
      ...prospectDto,
      country: dto.country ?? 'México',
      isActive: 1,
      estatus: dto.estatus ?? ProspectEstatus.NUEVO,
      logoUrl: await this.uploadProspectLogo(logo),
    });

    return this.prospectRepository.save(prospect);
  }

  async findAll(filter: FilterProspectDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.prospectRepository
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL');

    if (filter.isActive !== undefined) {
      qb.andWhere('p.isActive = :active', {
        active: filter.isActive ? 1 : 0,
      });
    }
    if (filter.estatus !== undefined) {
      qb.andWhere('p.estatus = :estatus', { estatus: filter.estatus });
    } else {
      qb.andWhere('(p.estatus IS NULL OR p.estatus IN (:...pipeline))', {
        pipeline: [ProspectEstatus.NUEVO, ProspectEstatus.EN_SEGUIMIENTO],
      });
    }
    if (filter.search?.trim()) {
      const s = `%${filter.search.trim()}%`;
      qb.andWhere(
        '(p.businessName LIKE :s OR p.tradeName LIKE :s OR p.email LIKE :s OR p.rfc LIKE :s)',
        { s },
      );
    }

    const [data, total] = await qb
      .orderBy('p.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: number) {
    const prospect = await this.prospectRepository.findOne({
      where: { id },
    });
    if (!prospect || prospect.deletedAt) {
      throw new NotFoundException('Prospecto no encontrado');
    }
    return prospect;
  }

  async update(
    id: number,
    dto: UpdateProspectDto,
    logo?: Express.Multer.File,
  ) {
    const prospect = await this.findOne(id);

    if (prospect.estatus === ProspectEstatus.CONVERTIDO) {
      throw new BadRequestException('No se puede editar un prospecto convertido');
    }

    const { logoUrl: _omitLogoUrl, estatus: _omitEstatus, ...rest } = dto;

    Object.assign(prospect, rest);

    const uploadedLogo = await this.uploadProspectLogo(logo);
    if (uploadedLogo) {
      prospect.logoUrl = uploadedLogo;
    }

    return this.prospectRepository.save(prospect);
  }

  async convertToClient(
    id: number,
    dto: ConvertProspectDto,
    logo?: Express.Multer.File,
  ) {
    const prospect = await this.findOne(id);

    if (prospect.estatus === ProspectEstatus.CONVERTIDO) {
      throw new BadRequestException('El prospecto ya fue convertido a cliente');
    }
    if (prospect.estatus === ProspectEstatus.DESCARTADO) {
      throw new BadRequestException(
        'No se puede convertir un prospecto descartado',
      );
    }

    await this.assertClientDoesNotExist(prospect);

    const client = await this.clientsService.create(
      {
        businessName: prospect.businessName,
        tradeName: prospect.tradeName ?? undefined,
        rfc: prospect.rfc ?? undefined,
        email: prospect.email,
        phone: prospect.phone ?? undefined,
        address: prospect.address ?? undefined,
        city: prospect.city ?? undefined,
        state: prospect.state ?? undefined,
        postalCode: prospect.postalCode ?? undefined,
        country: prospect.country,
        notes: prospect.notes ?? undefined,
        logoUrl: prospect.logoUrl ?? undefined,
        requiresCredit: dto.requiresCredit,
        amount: dto.amount,
        creditLine: dto.creditLine,
        discountPercentage: dto.discountPercentage,
        commissionPercentage: dto.commissionPercentage,
        creditBalance: dto.creditBalance,
      },
      logo,
    );

    prospect.estatus = ProspectEstatus.CONVERTIDO;
    await this.prospectRepository.save(prospect);

    return {
      client,
      convertedFromProspectId: id,
    };
  }

  async changeEstatus(id: number, estatus: ProspectEstatus) {
    const prospect = await this.findOne(id);

    if (prospect.estatus === ProspectEstatus.CONVERTIDO) {
      throw new BadRequestException(
        'No se puede cambiar el estatus de un prospecto convertido',
      );
    }
    if (estatus === ProspectEstatus.CONVERTIDO) {
      throw new BadRequestException(
        'Use POST /prospects/:id/convert-to-client para marcar como convertido',
      );
    }

    prospect.estatus = estatus;
    return this.prospectRepository.save(prospect);
  }
}
