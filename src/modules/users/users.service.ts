import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(dto: CreateUserDto) {
    await this.ensureEmailUnique(dto.email);
    const client = await this.clientRepository.findOne({
      where: { id: dto.clientId },
    });
    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }
    const role = await this.roleRepository.findOne({ where: { id: dto.roleId } });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }

    const user = this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      phone: dto.phone ?? null,
      client,
      role,
      isActive: 1,
      isVerified: 0,
    });
    return this.userRepository.save(user);
  }

  async findAll(filter: FilterUserDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.userRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.client', 'client')
      .leftJoinAndSelect('u.role', 'role')
      .where('u.deletedAt IS NULL');

    if (filter.clientId) {
      qb.andWhere('client.id = :clientId', { clientId: filter.clientId });
    }
    if (filter.roleId) {
      qb.andWhere('role.id = :roleId', { roleId: filter.roleId });
    }
    if (filter.isActive !== undefined) {
      qb.andWhere('u.isActive = :active', {
        active: filter.isActive ? 1 : 0,
      });
    }
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

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { client: true, role: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (dto.email && dto.email !== user.email) {
      await this.ensureEmailUnique(dto.email, id);
      user.email = dto.email;
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.roleId !== undefined) {
      const role = await this.roleRepository.findOne({
        where: { id: dto.roleId },
      });
      if (!role || role.deletedAt) {
        throw new NotFoundException('Rol no encontrado');
      }
      user.role = role;
    }
    return this.userRepository.save(user);
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    await this.userRepository.softRemove(user);
    return { deleted: true };
  }

  async toggleStatus(id: number) {
    const user = await this.findOne(id);
    user.isActive = user.isActive ? 0 : 1;
    return this.userRepository.save(user);
  }

  private async ensureEmailUnique(email: string, excludeId?: number) {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.email = :email', { email })
      .andWhere('u.deletedAt IS NULL');
    if (excludeId) {
      qb.andWhere('u.id != :id', { id: excludeId });
    }
    const exists = await qb.getExists();
    if (exists) {
      throw new ConflictException('El email ya está registrado');
    }
  }
}
