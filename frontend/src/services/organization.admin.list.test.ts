import { afterEach, describe, expect, it, vi } from "vitest";

const tenant = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/axios.customize", () => ({ tenantAxios: tenant }));

import {
  getAdminOrganizationDetailAPI,
  getAdminOrganizationsAPI,
} from "./organization.service";

afterEach(() => vi.clearAllMocks());

// UC44 - Admin dùng tiền tố /admin như UC43, không dùng chung /organizations với /organizations/me (UC11)
describe("UC44 Admin organization list request", () => {
  it("calls the Admin route and omits includeCancelled by default", async () => {
    await getAdminOrganizationsAPI({
      page: 2,
      pageSize: 20,
      includeCancelled: false,
    });
    expect(tenant.get).toHaveBeenCalledWith("/api/v1/admin/organizations", {
      params: { page: 2, pageSize: 20 },
    });
  });

  it("sends includeCancelled only when Admin turns it on", async () => {
    await getAdminOrganizationsAPI({
      page: 1,
      pageSize: 10,
      includeCancelled: true,
    });
    expect(tenant.get).toHaveBeenCalledWith("/api/v1/admin/organizations", {
      params: { page: 1, pageSize: 10, includeCancelled: true },
    });
  });
});

// UC44.1 - chi tiết cũng nằm dưới /admin/organizations, id được mã hóa trong path
describe("UC44.1 Admin organization detail request", () => {
  it("calls the Admin detail route with the encoded id", async () => {
    await getAdminOrganizationDetailAPI("a/b");
    expect(tenant.get).toHaveBeenCalledWith(
      "/api/v1/admin/organizations/a%2Fb",
    );
  });
});
