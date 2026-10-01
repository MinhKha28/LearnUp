import { Pagination } from "antd";
import { useSearchParams } from "react-router-dom";

import type { PageMeta } from "@/types/api.types";
import "./url.pagination.scss";

/** Phân trang theo tham số `page` trên URL, giữ nguyên các tham số khác. */
export const UrlPagination = ({ meta }: { meta: PageMeta }) => {
  const [, setSearchParams] = useSearchParams();

  if (meta.pages <= 1) return null;

  const goTo = (page: number) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(page));
      return next;
    });
    window.scrollTo({ top: 0 });
  };

  return (
    <Pagination
      className="learner-url-pagination"
      align="center"
      current={meta.current}
      pageSize={meta.pageSize}
      total={meta.total}
      showSizeChanger={false}
      onChange={goTo}
    />
  );
};
