import { describe, expect, it } from "vitest";
import type { IOrganizationProfile } from "@/types/organization.types";
import {
  changedFields,
  logoFileError,
  organizationErrorMessage,
  timezoneOptions,
  toFormValues,
} from "./organization.profile.view";

const profile: IOrganizationProfile = {
  id: "org-1",
  name: "Công ty ABC",
  taxCode: "0312345678",
  address: "123 Nguyễn Huệ",
  contactPhone: "+84901234567",
  contactEmail: "contact@abc.vn",
  logoUrl: null,
  timezone: "Asia/Ho_Chi_Minh",
  status: "Active",
  updatedAt: "2026-10-30T00:00:00Z",
};

describe("UC11.1 organization form", () => {
  it("sends only the fields that changed, normalised", () => {
    expect(
      changedFields(profile, {
        ...toFormValues(profile),
        name: "  Công ty   ABC ",
        address: "456 Lê Lợi",
        timezone: "Asia/Tokyo",
      }),
    ).toEqual({ address: "456 Lê Lợi", timezone: "Asia/Tokyo" });
  });

  it("sends nothing when the form is unchanged", () => {
    expect(changedFields(profile, toFormValues(profile))).toEqual({});
  });

  it("clears the contact email with null and lower-cases a new one", () => {
    expect(
      changedFields(profile, { ...toFormValues(profile), contactEmail: "  " }),
    ).toEqual({ contactEmail: null });
    expect(
      changedFields(profile, {
        ...toFormValues(profile),
        contactEmail: "NEW@ABC.VN",
      }),
    ).toEqual({ contactEmail: "new@abc.vn" });
  });

  it("lists modern IANA names, UTC and the current zone, sorted and without duplicates", () => {
    const options = timezoneOptions("Asia/Tokyo", [
      "Europe/Kiev",
      "Asia/Saigon",
      "Asia/Ho_Chi_Minh",
      "Asia/Tokyo",
    ]);
    expect(options).toEqual([
      "Asia/Ho_Chi_Minh",
      "Asia/Tokyo",
      "Europe/Kyiv",
      "UTC",
    ]);
  });

  it("accepts PNG and JPEG logos up to 2 MB only", () => {
    expect(logoFileError({ type: "image/png", size: 1024 })).toBeNull();
    expect(
      logoFileError({ type: "image/jpeg", size: 2 * 1024 * 1024 }),
    ).toBeNull();
    expect(logoFileError({ type: "image/webp", size: 1024 })).toContain(
      "PNG or JPEG",
    );
    expect(
      logoFileError({ type: "image/png", size: 2 * 1024 * 1024 + 1 }),
    ).toContain("2 MB");
  });

  it("explains backend errors without raw codes", () => {
    expect(organizationErrorMessage(403, "SUBSCRIPTION_NOT_ACTIVE")).toContain(
      "view only",
    );
    expect(organizationErrorMessage(400, "INVALID_TIMEZONE")).toBe(
      "Choose a timezone from the list.",
    );
    expect(organizationErrorMessage(500, "WHATEVER")).not.toContain("WHATEVER");
  });
});
