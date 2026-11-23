import { useNavigate } from "react-router-dom";

/** Back is one step in the history (the screen the Instructor came from); a page opened by its own address goes to `fallback`. */
export const useGoBack = (fallback = "/instructor/submissions") => {
  const navigate = useNavigate();
  return (to = fallback) => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate(to, { replace: true });
  };
};
