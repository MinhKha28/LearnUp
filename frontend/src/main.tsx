import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";

import { AppProvider } from "@/components/context/app.context";
import { router } from "@/router";

import "@/styles/global.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App>
      <AppProvider>
        <ConfigProvider locale={enUS}>
          <RouterProvider router={router} />
        </ConfigProvider>
      </AppProvider>
    </App>
  </StrictMode>,
);
