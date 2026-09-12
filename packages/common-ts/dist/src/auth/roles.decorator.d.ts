import { CustomDecorator } from '@nestjs/common';
import { PlatformRoleType } from './roles.constant';
export declare const ROLES_KEY = "learnup:roles";
export declare const Roles: (...roles: PlatformRoleType[]) => CustomDecorator<string>;
