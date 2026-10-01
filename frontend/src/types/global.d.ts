export { };
declare global {
  interface IBackendRes<T> {
    error?: string | string[];
    message: string;
    statusCode: number | string;
    data?: T;
  }

  interface IModelPaginate<T> {
    meta: {
      current: number;
      pageSize: number;
      pages: number;
      total: number;
    };
    result: T[];
  }

  // Khớp PageResponse<T> của @learnup/ts-common (backend trả trong data).
  interface IPageResponse<T> {
    meta: {
      current: number;
      pageSize: number;
      pages: number;
      total: number;
    };
    items: T[];
  }
}
