import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { AppModuleEntity } from './entities/app-module.entity';
import { Permission } from '../roles/entities/permission.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class AppModulesService {
  constructor(
    @InjectRepository(AppModuleEntity)
    private readonly moduleRepository: Repository<AppModuleEntity>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async findAll() {
    const modules = await this.moduleRepository.find({
      relations: { permissions: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return modules.map((m) => ({
      id: m.id,
      name: m.name,
      label: m.label,
      description: m.description,
      icon: m.icon,
      isActive: m.isActive,
      sortOrder: m.sortOrder,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      permissions: (m.permissions ?? []).map((p) => ({
        id: p.id,
        action: p.action,
        description: p.description,
      })),
    }));
  }

  async findOne(id: number) {
    const mod = await this.moduleRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!mod) {
      throw new NotFoundException('Módulo no encontrado');
    }
    return mod;
  }

  async create(dto: CreateModuleDto) {
    await this.ensureNameUnique(dto.name);
    const mod = this.moduleRepository.create({
      name: dto.name,
      label: dto.label,
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      isActive: 1,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.moduleRepository.save(mod);

    const actions = Object.values(PermissionAction);
    const perms = actions.map((action) =>
      this.permissionRepository.create({
        module: saved,
        action,
        description: `${action} en ${saved.label}`,
      }),
    );
    await this.permissionRepository.save(perms);

    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateModuleDto) {
    const mod = await this.findOne(id);
    if (dto.name && dto.name !== mod.name) {
      await this.ensureNameUnique(dto.name, id);
      mod.name = dto.name;
    }
    if (dto.label !== undefined) mod.label = dto.label;
    if (dto.description !== undefined) mod.description = dto.description;
    if (dto.icon !== undefined) mod.icon = dto.icon;
    if (dto.sortOrder !== undefined) mod.sortOrder = dto.sortOrder;
    return this.moduleRepository.save(mod);
  }

  async remove(id: number) {
    const mod = await this.findOne(id);
    await this.moduleRepository.remove(mod);
    return { deleted: true };
  }

  private async ensureNameUnique(name: string, excludeId?: number) {
    const qb = this.moduleRepository
      .createQueryBuilder('m')
      .where('m.name = :name', { name });
    if (excludeId) {
      qb.andWhere('m.id != :id', { id: excludeId });
    }
    if (await qb.getExists()) {
      throw new ConflictException('Ya existe un módulo con ese nombre');
    }
  }
}
