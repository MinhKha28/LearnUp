import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { revokeSessionAPI } from "@/services/identity.service";
import { endSession } from "@/services/sign.out";
import { REFRESH_TOKEN_KEY, clearTokens } from "@/utils/auth";

/** UC06: xóa phiên trên trình duyệt rồi thu hồi refresh token ở identity. Dùng chung cho 4 layout. */
export const useSignOut = () => {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useCurrentApp();

  return async () => {
    const confirmed = await endSession({
      readRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
      clearLocalSession: () => {
        clearTokens();
        setUser(null);
        setIsAuthenticated(false);
      },
      revoke: revokeSessionAPI,
    });
    // Server-side revocation that could not be confirmed is reported, not shown as a clean sign-out.
    navigate(confirmed ? "/login" : "/login?state=signed-out-unconfirmed", { replace: true });
  };
};
