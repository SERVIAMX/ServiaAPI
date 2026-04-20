import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Client } from './entities/client.entity';
import { CustomerBalance } from './entities/customer-balance.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { FilterClientDto } from './dto/filter-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepository: Repository<CustomerBalance>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClientDto) {
    const { creditBalance, ...clientDto } = dto;

    const client = this.clientRepository.create({
      ...clientDto,
      country: dto.country ?? 'México',
      isActive: 1,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const savedClient = await queryRunner.manager.save(Client, client);
      const balance = this.customerBalanceRepository.create({
        customer: savedClient,
        creditBalance: (creditBalance ?? 0).toFixed(2),
      });
      await queryRunner.manager.save(CustomerBalance, balance);

      await queryRunner.commitTransaction();
      return savedClient;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(filter: FilterClientDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.clientRepository
      .createQueryBuilder('c')
      .where('c.deletedAt IS NULL');

    if (filter.isActive !== undefined) {
      qb.andWhere('c.isActive = :active', {
        active: filter.isActive ? 1 : 0,
      });
    }
    if (filter.search?.trim()) {
      const s = `%${filter.search.trim()}%`;
      qb.andWhere(
        '(c.businessName LIKE :s OR c.tradeName LIKE :s OR c.email LIKE :s OR c.rfc LIKE :s)',
        { s },
      );
    }

    const [data, total] = await qb
      .orderBy('c.id', 'ASC')
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
    const client = await this.clientRepository.findOne({
      where: { id },
    });
    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return client;
  }

  async findUsersByClient(id: number, filter: FilterClientDto) {
    await this.findOne(id);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.client', 'client')
      .leftJoinAndSelect('u.role', 'role')
      .where('client.id = :id', { id })
      .andWhere('u.deletedAt IS NULL');

    if (filter.search?.trim()) {
      const s = `%${filter.search.trim()}%`;
      qb.andWhere(
        '(u.firstName LIKE :s OR u.lastName LIKE :s OR u.email LIKE :s)',
        { s },
      );
    }

    const [data, total] = await qb
      .orderBy('u.id', 'ASC')
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

  async update(id: number, dto: UpdateClientDto) {
    const client = await this.findOne(id);
    Object.assign(client, dto);
    return this.clientRepository.save(client);
  }

  async remove(id: number) {
    const client = await this.findOne(id);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager
        .createQueryBuilder()
        .softDelete()
        .from(User)
        .where('ClientId = :cid', { cid: id })
        .execute();
      await queryRunner.manager.softRemove(Client, client);
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
    return { deleted: true };
  }

  async toggleStatus(id: number) {
    const client = await this.findOne(id);
    client.isActive = client.isActive ? 0 : 1;
    return this.clientRepository.save(client);
  }
}
