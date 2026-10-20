import { describe, expect, it } from "vitest";
import {
  applyIdentityHeaders,
  assertLocalHost,
  buildIdentityHeaders,
  createIdentityProxy,
  describeIdentities,
  isDevIdentityKey,
  isIdentityProxyEnabled,
  parseIdentitySwitchBody,
  resolveIdentityProxySettings,
  type HeaderTarget,
} from "./identity.proxy";

/** Giữ nguyên hoa thường của tên header để kiểm việc xóa mọi biến thể. */
const createTarget = (initial: Record<string, string>) => {
  const headers = new Map(Object.entries(initial));
  const target: HeaderTarget = {
    getHeaderNames: () => [...headers.keys()],
    removeHeader: (name) => {
      headers.delete(name);
    },
    setHeader: (name, value) => headers.set(name, value),
  };
  return { target, headers };
};

describe("isIdentityProxyEnabled", () => {
  it("chỉ bật khi serve và cờ bằng 1", () => {
    expect(isIdentityProxyEnabled("serve", { DEV_IDENTITY_PROXY: "1" })).toBe(
      true,
    );
    expect(isIdentityProxyEnabled("build", { DEV_IDENTITY_PROXY: "1" })).toBe(
      false,
    );
    expect(
      isIdentityProxyEnabled("serve", { DEV_IDENTITY_PROXY: "true" }),
    ).toBe(false);
    expect(isIdentityProxyEnabled("serve", {})).toBe(false);
  });
});

describe("resolveIdentityProxySettings", () => {
  it("dùng giá trị mặc định khi chỉ có khóa nội bộ", () => {
    expect(
      resolveIdentityProxySettings({ DEV_INTERNAL_SERVICE_KEY: "k" }),
    ).toEqual({
      internalKey: "k",
      courseServiceUrl: "http://localhost:8083",
      learningServiceUrl: "http://localhost:8085",
      initialKey: "LEARNER_1",
    });
  });

  it("từ chối khi thiếu khóa nội bộ", () => {
    expect(() => resolveIdentityProxySettings({})).toThrow(
      /DEV_INTERNAL_SERVICE_KEY/,
    );
    expect(() =>
      resolveIdentityProxySettings({ DEV_INTERNAL_SERVICE_KEY: "  " }),
    ).toThrow(/DEV_INTERNAL_SERVICE_KEY/);
  });

  it("từ chối Learner ngoài bảng", () => {
    expect(() =>
      resolveIdentityProxySettings({
        DEV_INTERNAL_SERVICE_KEY: "k",
        DEV_PROXY_LEARNER: "HACKER",
      }),
    ).toThrow(/DEV_PROXY_LEARNER="HACKER"/);
  });
});

describe("isDevIdentityKey", () => {
  it("chỉ nhận 4 khóa trong bảng", () => {
    expect(isDevIdentityKey("LEARNER_1")).toBe(true);
    expect(isDevIdentityKey("LEARNER_3")).toBe(true);
    expect(isDevIdentityKey("LEARNER_4")).toBe(true);
    expect(isDevIdentityKey("LEARNER_5")).toBe(true);
    expect(isDevIdentityKey("LEARNER_6")).toBe(true);
    expect(isDevIdentityKey("ORGANIZER")).toBe(true);
    expect(isDevIdentityKey("learner_1")).toBe(false);
    expect(isDevIdentityKey("toString")).toBe(false);
    expect(isDevIdentityKey("__proto__")).toBe(false);
    expect(isDevIdentityKey(1)).toBe(false);
  });
});

describe("parseIdentitySwitchBody", () => {
  it("chỉ nhận body JSON có key trong bảng", () => {
    expect(parseIdentitySwitchBody('{"key":"LEARNER_2"}')).toBe("LEARNER_2");
    expect(parseIdentitySwitchBody('{"key":"HACKER"}')).toBeNull();
    expect(parseIdentitySwitchBody('{"key":"constructor"}')).toBeNull();
    expect(parseIdentitySwitchBody("{}")).toBeNull();
    expect(parseIdentitySwitchBody("null")).toBeNull();
    expect(parseIdentitySwitchBody("not json")).toBeNull();
  });
});

describe("assertLocalHost", () => {
  it("cho phép localhost", () => {
    expect(() => assertLocalHost(undefined)).not.toThrow();
    expect(() => assertLocalHost("localhost")).not.toThrow();
    expect(() => assertLocalHost("127.0.0.1")).not.toThrow();
  });

  it("từ chối host khác localhost", () => {
    expect(() => assertLocalHost(true)).toThrow(/server.host/);
    expect(() => assertLocalHost("0.0.0.0")).toThrow(/server.host/);
    expect(() => assertLocalHost("192.168.1.10")).toThrow(/server.host/);
    expect(() => assertLocalHost("")).toThrow(/server.host/);
  });
});

describe("applyIdentityHeaders", () => {
  it("dựng đúng 4 header theo danh tính", () => {
    expect(buildIdentityHeaders("LEARNER_3", "secret")).toEqual({
      "x-internal-key": "secret",
      "x-user-id": "01900000-0000-7000-8000-00000000b201",
      "x-user-role": "LEARNER",
      "x-organization-id": "01900000-0000-7000-8000-00000000b001",
    });
  });

  it("xóa header giả client gửi (mọi biến thể hoa thường) rồi ghi đè", () => {
    const { target, headers } = createTarget({
      accept: "application/json",
      "X-Internal-Key": "wrong",
      "x-user-id": "01900000-0000-7000-8000-00000000b201",
      "X-USER-ROLE": "ADMIN",
      "X-Organization-Id": "01900000-0000-7000-8000-00000000b001",
      "X-Dev-User-Id": "someone",
    });

    applyIdentityHeaders(target, "LEARNER_1", "secret");

    expect(Object.fromEntries(headers)).toEqual({
      accept: "application/json",
      "x-internal-key": "secret",
      "x-user-id": "01900000-0000-7000-8000-00000000a201",
      "x-user-role": "LEARNER",
      "x-organization-id": "01900000-0000-7000-8000-00000000a001",
    });
  });
});

describe("describeIdentities", () => {
  it("chỉ trả metadata hiển thị, không lộ ID hay khóa", () => {
    const result = describeIdentities("LEARNER_2");
    expect(result).toEqual({
      current: { key: "LEARNER_2", label: "Học viên 2 (Tổ chức A)", organizationLabel: "Tổ chức A", roleLabel: "Học viên" },
      options: [
        { key: "LEARNER_1", label: "Học viên 1 (Tổ chức A)" },
        { key: "LEARNER_2", label: "Học viên 2 (Tổ chức A)" },
        { key: "LEARNER_3", label: "Học viên 3 (Tổ chức B)" },
        { key: "LEARNER_4", label: "Học viên 4 (Tổ chức A)" },
        { key: "LEARNER_5", label: "Học viên 5 (Video chưa học)" },
        { key: "LEARNER_6", label: "Học viên 6 (Video đã xem 511 giây)" },
        { key: "ORGANIZER", label: "Quản lý đào tạo ABC" },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/01900000/);
  });
});

describe("createIdentityProxy", () => {
  const { proxy } = createIdentityProxy({
    internalKey: "secret",
    courseServiceUrl: "http://course",
    learningServiceUrl: "http://learning",
    initialKey: "LEARNER_1",
  });
  const targetOf = (url: string) =>
    Object.entries(proxy).find(([pattern]) =>
      new RegExp(pattern).test(url),
    )?.[1].target ?? null;

  it("chỉ chuyển tiếp 7 endpoint learner", () => {
    expect(targetOf("/api/v1/courses/catalog")).toBe("http://course");
    expect(targetOf("/api/v1/courses/catalog?page=2")).toBe("http://course");
    expect(targetOf("/api/v1/courses/abc/introduction")).toBe("http://course");
    expect(targetOf("/api/v1/courses/abc/introduction?x=1")).toBe(
      "http://course",
    );
    expect(targetOf("/api/v1/enrollments")).toBe("http://learning");
    expect(targetOf("/api/v1/enrollments?x=1")).toBe("http://learning");
    expect(targetOf("/api/v1/enrollments/me?page=1")).toBe("http://learning");
    expect(targetOf("/api/v1/enrollments/me/course-ids")).toBe(
      "http://learning",
    );
    expect(targetOf("/api/v1/enrollments/e1/curriculum")).toBe(
      "http://learning",
    );
    expect(targetOf("/api/v1/enrollments/e1/lessons/l1")).toBe(
      "http://learning",
    );
  });

  it("không chuyển tiếp endpoint khác", () => {
    expect(targetOf("/api/v1/courses")).toBeNull();
    expect(targetOf("/api/v1/courses?page=1")).toBeNull();
    expect(targetOf("/api/v1/courses/catalogue")).toBeNull();
    expect(targetOf("/api/v1/courses/abc")).toBeNull();
    expect(targetOf("/api/v1/courses/a/b/introduction")).toBeNull();
    expect(targetOf("/api/v1/courses/abc/introduction/x")).toBeNull();
    expect(targetOf("/api/v1/enrollments-admin")).toBeNull();
    expect(targetOf("/api/v1/enrollment-status-intervals")).toBeNull();
    expect(targetOf("/x/api/v1/enrollments")).toBeNull();
  });
});

it("describes the organization and role of the selected demo persona", () => {
  expect(describeIdentities("LEARNER_3").current).toMatchObject({ organizationLabel: "Tổ chức B", roleLabel: "Học viên" });
  expect(describeIdentities("ORGANIZER").current).toMatchObject({ organizationLabel: "Tổ chức A", roleLabel: "Quản lý đào tạo" });
});
