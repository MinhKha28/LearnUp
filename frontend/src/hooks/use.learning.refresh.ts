import { useEffect } from "react";

const pendingRefreshes = new Map<string, ReturnType<typeof setTimeout>[]>();

/** Keep the three notifications across route changes; this stores no progress payload. */
export function notifyLearningProgress(enrollmentId: string, pending: boolean) {
  pendingRefreshes.get(enrollmentId)?.forEach(clearTimeout);
  pendingRefreshes.delete(enrollmentId);
  const notify = () =>
    window.dispatchEvent(
      new CustomEvent("learning-progress", { detail: { enrollmentId } }),
    );
  notify();
  if (pending)
    pendingRefreshes.set(
      enrollmentId,
      [2000, 4000, 6000].map((ms, index) =>
        setTimeout(() => {
          notify();
          if (index === 2) pendingRefreshes.delete(enrollmentId);
        }, ms),
      ),
    );
}

/** A bounded refresh for async completion; focus also reconciles changes from other tabs. */
export function useLearningRefresh(reload: () => void, enrollmentId: string) {
  useEffect(() => {
    const refresh = () => reload();
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const progress = (event: Event) => {
      const detail = (event as CustomEvent<{ enrollmentId: string }>).detail;
      if (
        enrollmentId &&
        detail?.enrollmentId &&
        detail.enrollmentId !== enrollmentId
      )
        return;
      reload();
    };
    window.addEventListener("learning-progress", progress);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("learning-progress", progress);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload, enrollmentId]);
}
