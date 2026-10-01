import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import {
  createIdentityProxy,
  isIdentityProxyEnabled,
  resolveIdentityProxySettings,
} from "./dev/identity.proxy";
// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const identityProxy = isIdentityProxyEnabled(command, env)
    ? createIdentityProxy(resolveIdentityProxySettings(env))
    : null;

  return {
    plugins: [react(), tsconfigPaths(), ...(identityProxy ? [identityProxy.plugin] : [])],
    server: {
      port: 3000,
      ...(identityProxy && {
        proxy: identityProxy.proxy,
        // Proxy tự gắn danh tính nên chỉ cho trang từ localhost đọc phản hồi
        cors: { origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ },
      }),
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler", // or "modern"
        },
      },
    },
  };
});
