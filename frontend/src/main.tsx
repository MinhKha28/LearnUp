import { StrictMode } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";

import { AppProvider } from "@/components/context/app.context";
import { router } from "@/router";

import "@/styles/global.scss";

const locale = {
  ...viVN,
  Modal: { okText: "Đồng ý", cancelText: "Hủy", justOkText: "Đồng ý" },
};

const closeControl = {
  closeIcon: (
    <span
      aria-hidden="true"
      ref={(icon) => icon?.closest("button")?.setAttribute("aria-label", "Đóng")}
    >
      <CloseOutlined aria-hidden="true" />
    </span>
  ),
};

dayjs.locale("vi");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider locale={locale} modal={closeControl} drawer={closeControl}>
      <App>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
