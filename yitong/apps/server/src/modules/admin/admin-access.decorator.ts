import { SetMetadata } from '@nestjs/common';
import type { AdminPermissionCode } from './admin-permissions';

export const ADMIN_PERMISSION_KEY = 'admin:permissions';
export const ADMIN_ALLOW_ANY_KEY = 'admin:allow-any';

export const RequireAdminPermission = (...permissions: AdminPermissionCode[]) =>
  SetMetadata(ADMIN_PERMISSION_KEY, permissions);

export const AllowAnyAdmin = () => SetMetadata(ADMIN_ALLOW_ANY_KEY, true);
