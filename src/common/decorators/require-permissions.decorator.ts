import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '../enums/permission-action.enum';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: string;
  action: PermissionAction;
}

export const RequirePermissions = (module: string, action: PermissionAction) =>
  SetMetadata(PERMISSIONS_KEY, { module, action } as RequiredPermission);
