import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/services/axios.customize", () => ({ default: { post, get: vi.fn() } }));

import GoogleSignIn from "@/components/guest/google.sign.in";
import { GOOGLE_UNAVAILABLE_MESSAGE, googleSignInMessage } from "@/utils/google.sign.in";
import { googleLoginAPI } from "@/services/identity.service";
import { signInMessage } from "@/utils/auth";

describe("UC05.1 Google sign-in button", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    post.mockReset();
  });

  it.each(["", "   "])("renders nothing when the Google client ID is %j", (clientId) => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", clientId);
    const html = renderToStaticMarkup(<GoogleSignIn onCredential={() => {}} onError={() => {}} />);
    expect(html).toBe("");
  });

  it("renders the container for Google's official button when a client ID is configured", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "1234567890-test.apps.googleusercontent.com");
    const html = renderToStaticMarkup(<GoogleSignIn disabled onCredential={() => {}} onError={() => {}} />);
    expect(html).toContain("login-google-gis");
    expect(html).toContain('aria-disabled="true"');
  });

  it("maps every UC05.1 error code to a user message without exposing technical detail", () => {
    expect(googleSignInMessage("GOOGLE_ACCOUNT_NOT_LINKED")).toBe(
      "Email Google này chưa được liên kết với tài khoản LearnUP.",
    );
    expect(googleSignInMessage("GOOGLE_SIGN_IN_NOT_ALLOWED")).toContain("email và mật khẩu");
    expect(googleSignInMessage("GOOGLE_CREDENTIAL_INVALID")).toBe(
      "Không xác minh được đăng nhập bằng Google. Vui lòng thử lại.",
    );
    expect(googleSignInMessage("GOOGLE_SIGN_IN_UNAVAILABLE")).toBe(GOOGLE_UNAVAILABLE_MESSAGE);
  });

  it("reuses the UC05 wording for Tenant eligibility denials", () => {
    for (const code of ["ORGANIZATION_NOT_ACTIVE", "SUBSCRIPTION_ENDED", "TENANT_UNAVAILABLE", undefined]) {
      expect(googleSignInMessage(code)).toBe(signInMessage(code));
    }
  });

  it("sends only the Google credential to the Identity Google sign-in endpoint", async () => {
    post.mockResolvedValue({ success: true, data: {} });
    await googleLoginAPI("synthetic.google.credential");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/v1/auth/google", { credential: "synthetic.google.credential" });
  });
});
