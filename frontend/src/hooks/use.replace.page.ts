import { useSearchParams } from "react-router-dom";

/** Thay tham số `page` trên URL bằng `replace`, giữ các tham số khác (D41). */
export const useReplacePage = () => {
  const [, setSearchParams] = useSearchParams();
  return (page: number) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("page", String(page));
        return next;
      },
      { replace: true },
    );
};
