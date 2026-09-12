import { BaseException } from './base.exception';
export declare class ResourceNotFoundException extends BaseException {
    constructor(resourceNameOrMessage: string, identifier?: string);
}
