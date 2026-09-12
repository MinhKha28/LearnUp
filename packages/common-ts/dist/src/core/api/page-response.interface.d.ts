import { PageMeta } from './page-meta.interface';
export interface PageResponse<T> {
    items: T[];
    meta: PageMeta;
}
