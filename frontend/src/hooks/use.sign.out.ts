import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { logoutAPI } from "@/services/identity.service";
import { REFRESH_TOKEN_KEY, clearTokens } from "@/utils/auth";

/** UC06: thu hồi refresh token ở identity rồi xóa phiên trên trình duyệt. Dùng chung cho 4 layout. */
export const useSignOut = () => {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useCurrentApp();

  return async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (refreshToken) await logoutAPI(refreshToken);
    } catch {
      // Mất mạng hoặc identity lỗi: vẫn đăng xuất ở trình duyệt, token còn lại tự hết hạn
    }
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    navigate("/login", { replace: true });
  };
};
