import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ProxyOptions } from "vite";

/**
 * Proxy danh tính chỉ dùng khi dev (D37): gateway và đăng nhập chưa chạy nên dev server
 * tự gắn danh tính Learner seed và khóa nội bộ trước khi chuyển request tới service.
 * File này chạy trong tiến trình Node của Vite, không bao giờ được import từ src.
 */

export const LEARNER_ROLE = "LEARNER";

export const DEV_IDENTITIES = {
  LEARNER_1: {
    userId: "01900000-0000-7000-8000-00000000a201",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Học viên 1 (Tổ chức A)",
  },
  LEARNER_2: {
    userId: "01900000-0000-7000-8000-00000000a202",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Học viên 2 (Tổ chức A)",
  },
  LEARNER_3: {
    userId: "01900000-0000-7000-8000-00000000b201",
    organizationId: "01900000-0000-7000-8000-00000000b001",
    label: "Học viên 3 (Tổ chức B)",
  },
  LEARNER_4: {
    userId: "01900000-0000-7000-8000-00000000a206",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Học viên 4 (Tổ chức A)",
  },
  LEARNER_5: {
    userId: "01900000-0000-7000-8000-00000000a208",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Học viên 5 (Video chưa học)",
  },
  LEARNER_6: {
    userId: "01900000-0000-7000-8000-00000000a210",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Học viên 6 (Video đã xem 511 giây)",
  },
  ORGANIZER: {
    userId: "01900000-0000-7000-8000-00000000a010",
    organizationId: "01900000-0000-7000-8000-00000000a001",
    label: "Organizer ABC",
    role: "ORGANIZER",
  },
} as const;

export type DevIdentityKey = keyof typeof DEV_IDENTITIES;

export const DEV_IDENTITY_ENDPOINT = "/__dev/identity";

/** Header danh tính bị xóa khỏi mọi request đi qua proxy rồi gắn lại từ danh tính hiện tại. */
export const IDENTITY_HEADER_NAMES = [
  "x-internal-key",
  "x-user-id",
  "x-user-role",
  "x-organization-id",
  "x-dev-user-id",
] as const;

const LOCAL_HOSTS = new Set<string | undefined>([
  undefined,
  "localhost",
  "127.0.0.1",
]);

const MAX_BODY_BYTES = 1024;

export interface IdentityProxyEnv {
  DEV_IDENTITY_PROXY?: string;
  DEV_INTERNAL_SERVICE_KEY?: string;
  DEV_COURSE_SERVICE_URL?: string;
  DEV_LEARNING_SERVICE_URL?: string;
  DEV_PROXY_LEARNER?: string;
}

export interface IdentityProxySettings {
  internalKey: string;
  courseServiceUrl: string;
  learningServiceUrl: string;
  initialKey: DevIdentityKey;
}

export interface HeaderTarget {
  getHeaderNames(): string[];
  removeHeader(name: string): void;
  setHeader(name: string, value: string): unknown;
}

export const isDevIdentityKey = (value: unknown): value is DevIdentityKey =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(DEV_IDENTITIES, value);

export const isIdentityProxyEnabled = (
  command: string,
  env: IdentityProxyEnv,
): boolean => command === "serve" && env.DEV_IDENTITY_PROXY === "1";

export const resolveIdentityProxySettings = (
  env: IdentityProxyEnv,
): IdentityProxySettings => {
  const internalKey = env.DEV_INTERNAL_SERVICE_KEY?.trim();
  if (!internalKey) {
    throw new Error(
      "[dev-identity-proxy] DEV_IDENTITY_PROXY=1 nhưng thiếu DEV_INTERNAL_SERVICE_KEY trong .env.development.local.",
    );
  }
  const initialKey = env.DEV_PROXY_LEARNER?.trim() || "LEARNER_1";
  if (!isDevIdentityKey(initialKey)) {
    throw new Error(
      `[dev-identity-proxy] DEV_PROXY_LEARNER="${initialKey}" không hợp lệ, chỉ nhận: ${Object.keys(DEV_IDENTITIES).join(", ")}.`,
    );
  }
  return {
    internalKey,
    courseServiceUrl:
      env.DEV_COURSE_SERVICE_URL?.trim() || "http://localhost:8083",
    learningServiceUrl:
      env.DEV_LEARNING_SERVICE_URL?.trim() || "http://localhost:8085",
    initialKey,
  };
};

/** Proxy gắn khóa nội bộ nên dev server chỉ được nghe trên máy local. */
export const assertLocalHost = (host: string | boolean | undefined): void => {
  if (typeof host === "boolean" || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `[dev-identity-proxy] server.host=${JSON.stringify(host)} không được phép khi bật proxy danh tính, chỉ nhận localhost hoặc 127.0.0.1.`,
    );
  }
};

export const buildIdentityHeaders = (
  key: DevIdentityKey,
  internalKey: string,
): Record<string, string> => {
  const identity = DEV_IDENTITIES[key];
  return {
    "x-internal-key": internalKey,
    "x-user-id": identity.userId,
    "x-user-role": "role" in identity ? identity.role : LEARNER_ROLE,
    "x-organization-id": identity.organizationId,
  };
};

export const applyIdentityHeaders = (
  target: HeaderTarget,
  key: DevIdentityKey,
  internalKey: string,
): void => {
  const blocked = new Set<string>(IDENTITY_HEADER_NAMES);
  for (const name of target.getHeaderNames()) {
    if (blocked.has(name.toLowerCase())) {
      target.removeHeader(name);
    }
  }
  for (const [name, value] of Object.entries(
    buildIdentityHeaders(key, internalKey),
  )) {
    target.setHeader(name, value);
  }
};

export const describeIdentities = (current: DevIdentityKey) => ({
  current: { key: current, label: DEV_IDENTITIES[current].label },
  options: (Object.keys(DEV_IDENTITIES) as DevIdentityKey[]).map((key) => ({
    key,
    label: DEV_IDENTITIES[key].label,
  })),
});

export const parseIdentitySwitchBody = (raw: string): DevIdentityKey | null => {
  try {
    const body: unknown = JSON.parse(raw);
    if (
      body &&
      typeof body === "object" &&
      "key" in body &&
      isDevIdentityKey(body.key)
    ) {
      return body.key;
    }
  } catch {
    return null;
  }
  return null;
};

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string | null> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

export const createIdentityProxy = (settings: IdentityProxySettings) => {
  let currentKey: DevIdentityKey = settings.initialKey;

  const withIdentity = (target: string): ProxyOptions => ({
    target,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        applyIdentityHeaders(proxyReq, currentKey, settings.internalKey);
      });
    },
  });

  const proxy: Record<string, ProxyOptions> = {
    "^/api/v1/assignments(/|[?]|$)": withIdentity(settings.learningServiceUrl),
    "^/api/v1/users/learners([?]|$)": withIdentity("http://localhost:8084"),
    "^/api/v1/courses/organization([?]|$)": withIdentity(
      settings.courseServiceUrl,
    ),
    "^/api/v1/courses/catalog(\\?|$)": withIdentity(settings.courseServiceUrl),
    "^/api/v1/courses/[^/?]+/introduction(\\?|$)": withIdentity(
      settings.courseServiceUrl,
    ),
    "^/api/v1/enrollments(/|\\?|$)": withIdentity(settings.learningServiceUrl),
  };

  const handleIdentityRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
  ) => {
    if (req.method === "GET") {
      sendJson(res, 200, describeIdentities(currentKey));
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      sendJson(res, 405, { message: "Method not allowed" });
      return;
    }
    // Bắt buộc JSON để request từ trang web khác phải qua preflight CORS (dev server không trả lời preflight này)
    if (
      !req.headers["content-type"]?.toLowerCase().startsWith("application/json")
    ) {
      sendJson(res, 415, { message: "Content-Type must be application/json" });
      return;
    }
    const raw = await readBody(req);
    const key = raw === null ? null : parseIdentitySwitchBody(raw);
    if (!key) {
      sendJson(res, 400, { message: "Unknown identity key" });
      return;
    }
    currentKey = key;
    sendJson(res, 200, describeIdentities(currentKey));
  };

  const plugin: Plugin = {
    name: "learnup-dev-identity-proxy",
    apply: "serve",
    configResolved(config) {
      assertLocalHost(config.server.host);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== DEV_IDENTITY_ENDPOINT) {
          next();
          return;
        }
        handleIdentityRequest(req, res).catch(next);
      });
    },
  };

  return { proxy, plugin };
};
