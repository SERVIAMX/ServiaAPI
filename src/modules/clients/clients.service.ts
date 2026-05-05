import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Client } from './entities/client.entity';
import { BalanceHistory } from './entities/balance-history.entity';
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
    @InjectRepository(BalanceHistory)
    private readonly balanceHistoryRepository: Repository<BalanceHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClientDto) {
    const {
      creditBalance,
      creditLine,
      discountPercentage,
      commissionPercentage,
      amount,
      requiresCredit,
      ...clientDto
    } = dto;

    const amountVal = amount ?? 0;
    const creditBalVal = creditBalance ?? 0;

    if (requiresCredit) {
      if (creditBalVal <= 0) {
        throw new BadRequestException(
          'RequiresCredit=true requiere CreditBalance > 0',
        );
      }
      if (creditLine === undefined || creditLine === null) {
        throw new BadRequestException(
          'RequiresCredit=true requiere CreditLine (límite de crédito)',
        );
      }
      if (creditBalVal > creditLine) {
        throw new BadRequestException(
          'CreditBalance no puede ser mayor a CreditLine',
        );
      }
    } else {
      if (amountVal <= 0) {
        throw new BadRequestException(
          'RequiresCredit=false requiere Amount > 0',
        );
      }
    }

    const client = this.clientRepository.create({
      ...clientDto,
      country: dto.country ?? 'México',
      isActive: 1,
      creditLine: creditLine === undefined ? null : creditLine.toFixed(2),
      discountPercentage:
        discountPercentage === undefined ? null : discountPercentage.toFixed(2),
      commissionPercentage:
        commissionPercentage === undefined
          ? null
          : commissionPercentage.toFixed(2),
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const savedClient = await queryRunner.manager.save(client);

      const balance = this.customerBalanceRepository.create({
        customer: savedClient,
        creditBalance: requiresCredit ? creditBalVal.toFixed(2) : '0.00',
        balance: amountVal > 0 ? amountVal.toFixed(2) : '0.00',
      });
      await queryRunner.manager.save(balance);

      const historyToInsert: BalanceHistory[] = [];
      if (creditBalVal > 0) {
        historyToInsert.push(
          this.balanceHistoryRepository.create({
            customer: savedClient,
            amount: creditBalVal.toFixed(2),
            transactionType: 2,
            isPaid: 0,
          }),
        );
      }
      if (amountVal > 0) {
        historyToInsert.push(
          this.balanceHistoryRepository.create({
            customer: savedClient,
            amount: amountVal.toFixed(2),
            transactionType: 1,
            isPaid: 1,
          }),
        );
      }
      for (const h of historyToInsert) {
        await queryRunner.manager.save(h);
      }

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

    const { creditLine, discountPercentage, commissionPercentage, ...rest } = dto as UpdateClientDto & {
      creditLine?: number | null;
      discountPercentage?: number | null;
      commissionPercentage?: number | null;
    };

    Object.assign(client, rest);
    if (creditLine !== undefined) {
      client.creditLine = creditLine === null ? null : creditLine.toFixed(2);
    }
    if (discountPercentage !== undefined) {
      client.discountPercentage =
        discountPercentage === null ? null : discountPercentage.toFixed(2);
    }
    if (commissionPercentage !== undefined) {
      client.commissionPercentage =
        commissionPercentage === null ? null : commissionPercentage.toFixed(2);
    }

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
