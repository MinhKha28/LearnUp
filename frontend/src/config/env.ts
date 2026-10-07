/** Mỗi backend service một biến base URL; tên biến theo dạng VITE_<TÊN_SERVICE>_BACKEND_URL. */
const BACKEND_URL_VARS = {
  tenant: "VITE_TENANT_BACKEND_URL",
  course: "VITE_COURSE_BACKEND_URL",
  assessment: "VITE_ASSESSMENT_BACKEND_URL",
} as const;

export type BackendService = keyof typeof BACKEND_URL_VARS;

// Đọc trực tiếp từng biến (không qua import.meta.env[key]) để Vite thay giá trị lúc build
const rawBackendUrls: Record<BackendService, string | undefined> = {
  tenant: import.meta.env.VITE_TENANT_BACKEND_URL,
  course: import.meta.env.VITE_COURSE_BACKEND_URL,
  assessment: import.meta.env.VITE_ASSESSMENT_BACKEND_URL,
};

const readBackendUrls = (): Record<BackendService, string> => {
  const services = Object.keys(BACKEND_URL_VARS) as BackendService[];
  const missing = services.filter((service) => !rawBackendUrls[service]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[env] Thiếu biến môi trường: ${missing.map((service) => BACKEND_URL_VARS[service]).join(", ")}. ` +
        "Khai báo trong frontend/.env.development.local (xem frontend/.env.example) rồi khởi động lại Vite.",
    );
  }
  return Object.fromEntries(
    services.map((service) => [service, rawBackendUrls[service]!.trim().replace(/\/+$/, "")]),
  ) as Record<BackendService, string>;
};

export const env = {
  backendUrl: readBackendUrls(),
} as const;
