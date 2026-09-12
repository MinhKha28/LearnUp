import { PlatformRoleType } from '../constants/roles.constant';
export interface JwtClaims {
    sub: string;
    role: PlatformRoleType;
    organizationId: string;
    iat: number;
    exp: number;
    iss?: string;
    aud?: string;
}
