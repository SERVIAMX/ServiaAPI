import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../../modules/roles/entities/role.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roleId?: number } | undefined;
    if (!user?.roleId) {
      throw new ForbiddenException('Sin rol asignado');
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.roleId },
      relations: {
        rolePermissions: {
          permission: { module: true },
        },
      },
    });

    if (!role?.rolePermissions?.length) {
      throw new ForbiddenException('No tiene permisos suficientes');
    }

    const allowed = role.rolePermissions.some(
      (rp) =>
        rp.permission?.module?.name === required.module &&
        rp.permission?.action === required.action,
    );

    if (!allowed) {
      throw new ForbiddenException('No tiene permisos suficientes');
    }

    return true;
  }
}
