import { JwtPayload } from './jwt-payload.interface';
import { CurrentUser } from './current-user';
export declare class JwtHelper {
    static decodePayload(token: string): JwtPayload | null;
    static isValidPayload(payload: unknown): payload is JwtPayload;
    static toCurrentUser(payload: JwtPayload, correlationId?: string): CurrentUser;
}
