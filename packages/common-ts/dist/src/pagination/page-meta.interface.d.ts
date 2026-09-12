export interface PageMeta {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}
export declare function createPageMeta(page: number, size: number, totalElements: number): PageMeta;
