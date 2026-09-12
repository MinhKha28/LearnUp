import { BaseException } from './base.exception';
export declare class ConflictException extends BaseException {
    constructor(resourceNameOrMessage: string, field?: string, value?: string);
}
