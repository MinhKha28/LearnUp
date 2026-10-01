import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { toApiError } from "@/services/api.client";
import type { ApiError } from "@/types/api.types";

export type ApiQueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: ApiError };

const LOADING = { status: "loading", data: null, error: null } as const;

const toQueryError = (error: unknown): ApiError | null => {
  try {
    return toApiError(error);
  } catch {
    return null;
  }
};

/**
 * Gọi API theo `deps`. Mỗi lần `deps` đổi hoặc `reload`, request cũ bị hủy và kết quả
 * của nó bị bỏ qua, nên chuyển trang nhanh không hiện nhầm dữ liệu trang trước.
 */
export const useApiQuery = <T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList) => {
  const [state, setState] = useState<ApiQueryState<T>>(LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    setState(LOADING);
    fetcherRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ status: "success", data, error: null });
        }
      },
      (error: unknown) => {
        const apiError = toQueryError(error);
        if (!controller.signal.aborted && apiError) {
          setState({ status: "error", data: null, error: apiError });
        }
      },
    );
    return () => controller.abort();
    // deps do nơi gọi truyền vào, fetcher luôn lấy bản mới nhất qua ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, ...deps]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, reload };
};
