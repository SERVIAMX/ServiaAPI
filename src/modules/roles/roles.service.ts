import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { FilterRoleDto } from './dto/filter-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async create(dto: CreateRoleDto) {
    await this.ensureNameUnique(dto.name);
    const role = this.roleRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: 1,
      isSystem: dto.isSystem ? 1 : 0,
    });
    return this.roleRepository.save(role);
  }

  async findAll(filter: FilterRoleDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.roleRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.rolePermissions', 'rp')
      .leftJoinAndSelect('rp.permission', 'perm')
      .leftJoinAndSelect('perm.module', 'mod')
      .where('r.deletedAt IS NULL');

    if (filter.isActive !== undefined) {
      qb.andWhere('r.isActive = :a', { a: filter.isActive ? 1 : 0 });
    }
    if (filter.search?.trim()) {
      const s = `%${filter.search.trim()}%`;
      qb.andWhere('(r.name LIKE :s OR r.description LIKE :s)', { s });
    }

    const [roles, total] = await qb
      .orderBy('r.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = roles.map((r) => this.toRoleWithGroupedPermissions(r));
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
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: {
        rolePermissions: { permission: { module: true } },
      },
    });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }
    return this.toRoleWithGroupedPermissions(role);
  }

  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('No se puede renombrar un rol de sistema');
    }
    if (dto.name && dto.name !== role.name) {
      await this.ensureNameUnique(dto.name, id);
      role.name = dto.name;
    }
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.isActive !== undefined) {
      role.isActive = dto.isActive ? 1 : 0;
    }
    return this.roleRepository.save(role);
  }

  async remove(id: number) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }
    /*if (role.isSystem) {
      throw new BadRequestException('No se puede eliminar un rol de sistema');
    }¨*/
    await this.roleRepository.softRemove(role);
    return { deleted: true };
  }

  async assignPermissions(roleId: number, permissionIds: number[]) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }
    const perms = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });
    if (perms.length !== permissionIds.length) {
      throw new BadRequestException('Uno o más permisos no existen');
    }

    await this.rolePermissionRepository
      .createQueryBuilder()
      .delete()
      .from(RolePermission)
      .where('RoleId = :rid', { rid: roleId })
      .execute();

    const rows = permissionIds.map((pid) =>
      this.rolePermissionRepository.create({
        role,
        permission: { id: pid } as Permission,
      }),
    );
    await this.rolePermissionRepository.save(rows);

    return this.findOne(roleId);
  }

  async removePermissions(roleId: number, permissionIds: number[]) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role || role.deletedAt) {
      throw new NotFoundException('Rol no encontrado');
    }
    await this.rolePermissionRepository
      .createQueryBuilder()
      .delete()
      .from(RolePermission)
      .where('RoleId = :rid', { rid: roleId })
      .andWhere('PermissionId IN (:...pids)', { pids: permissionIds })
      .execute();
    return this.findOne(roleId);
  }

  private toRoleWithGroupedPermissions(role: Role) {
    const byModule = new Map<
      number,
      { module: Record<string, unknown>; actions: string[] }
    >();

    for (const rp of role.rolePermissions ?? []) {
      const p = rp.permission;
      const m = p?.module;
      if (!m?.id) continue;
      if (!byModule.has(m.id)) {
        byModule.set(m.id, {
          module: {
            id: m.id,
            name: m.name,
            label: m.label,
            icon: m.icon,
          },
          actions: [],
        });
      }
      byModule.get(m.id)!.actions.push(p.action);
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissionsByModule: [...byModule.values()],
    };
  }

  private async ensureNameUnique(name: string, excludeId?: number) {
    const qb = this.roleRepository
      .createQueryBuilder('r')
      .where('r.name = :name', { name })
      .andWhere('r.deletedAt IS NULL');
    if (excludeId) {
      qb.andWhere('r.id != :id', { id: excludeId });
    }
    if (await qb.getExists()) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }
  }
}
