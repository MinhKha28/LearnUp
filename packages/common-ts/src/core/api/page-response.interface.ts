import { PageMeta } from './page-meta.interface';

/**
 * Standard paginated item list with metadata.
 */
export interface PageResponse<T> {
  items: T[];
  meta: PageMeta;
}
