import { PageResponse } from './page-response.interface';
import { PageMeta } from './page-meta.interface';
export declare class PaginationUtils {
    static readonly DEFAULT_PAGE = 0;
    static readonly DEFAULT_SIZE = 20;
    static readonly MAX_SIZE = 100;
    static clampPage(page?: number | string | null): number;
    static clampSize(size?: number | string | null, defaultSize?: number, maxSize?: number): number;
    static calculateOffset(page?: number | null, size?: number | null): number;
    static createMeta(page: number, size: number, totalElements: number): PageMeta;
    static paginateArray<T>(items: T[], page?: number | null, size?: number | null): PageResponse<T>;
}
