import { PageMeta } from './page-meta.interface';
export interface PageResponse<T> {
    items: T[];
    meta: PageMeta;
}
export declare function createPageResponse<T>(items: T[], page: number, size: number, totalElements: number): PageResponse<T>;
