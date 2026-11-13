import { CloseCircleFilled } from "@ant-design/icons";
import type { PaginationProps } from "antd";
import { cloneElement, isValidElement, type ReactNode } from "react";

export const vietnameseClear = {
  clearIcon: (
    <CloseCircleFilled
      aria-hidden="true"
      ref={(icon) => icon?.closest('[role="button"]')?.setAttribute("aria-label", "Xóa giá trị")}
    />
  ),
};

export const vietnamesePageItem: NonNullable<PaginationProps["itemRender"]> = (_, type, original) => {
  if ((type !== "prev" && type !== "next") || !isValidElement<{ children?: ReactNode; "aria-label"?: string }>(original)) {
    return original;
  }
  return cloneElement(
    original,
    { "aria-label": type === "prev" ? "Trang trước" : "Trang sau" },
    <span aria-hidden="true">{original.props.children}</span>,
  );
};
