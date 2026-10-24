import { describe, expect, it } from "vitest";
import { CloudinaryStorageProvider } from "../src/index.js";

// Offline SDK checks only. These synthetic credentials never contact Cloudinary.
describe("Cloudinary 2.7.0 offline signing", () => {
  it.each(["upload", "private", "authenticated"] as const)(
    "encodes %s and expiry in an API download URL",
    (deliveryType) => {
      const provider = new CloudinaryStorageProvider({
        cloudName: "fixture-cloud",
        apiKey: "fixture-key",
        apiSecret: "fixture-secret",
      });
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      const url = new URL(
        provider.getSignedUrl("achievement/logo", {
          resourceType: "image",
          format: "png",
          deliveryType,
          expiresAt,
        }),
      );
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("api.cloudinary.com");
      expect(url.pathname).toBe("/v1_1/fixture-cloud/image/download");
      expect(url.searchParams.get("public_id")).toBe("achievement/logo");
      expect(url.searchParams.get("type")).toBe(deliveryType);
      expect(url.searchParams.get("format")).toBe("png");
      expect(url.searchParams.get("expires_at")).toBe(String(expiresAt));
      expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{40}$/);
      expect(url.searchParams.has("api_secret")).toBe(false);
    },
  );
});
