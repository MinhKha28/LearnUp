export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
  timestamp: string;
  path: string;
}

export interface PageResponse<T> {
  meta: {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  items: T[];
}

export function createPageResponse<T>(
  items: T[],
  page: number,
  size: number,
  totalElements: number,
): PageResponse<T> {
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;

  return {
    meta: {
      current: page,
      pageSize: size,
      pages: totalPages,
      total: totalElements,
    },
    items,
  };
}
