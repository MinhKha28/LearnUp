import { PlatformRoleType } from './roles.constant';
export interface JwtPayload {
    sub: string;
    role: PlatformRoleType;
    organizationId: string;
    iat: number;
    exp: number;
    iss?: string;
    aud?: string;
}
