import { useEffect, useRef, useState } from "react";
import { downloadCertificate } from "@/services/achievement.service";
import { ApiError } from "@/types/api.types";
export function useCertificateDownload() {
  const requests = useRef(new Map<string, AbortController>());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  useEffect(() => {
    const pending = requests.current;
    return () => {
      pending.forEach((controller) => controller.abort());
      pending.clear();
    };
  }, []);
  const download = async (id: string) => {
    if (requests.current.has(id)) return;
    const controller = new AbortController();
    requests.current.set(id, controller);
    setBusy(new Set(requests.current.keys()));
    setMessages((previous) => ({ ...previous, [id]: "" }));
    try {
      const result = await downloadCertificate(id, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessages((previous) => ({ ...previous, [id]: "Đã tải chứng chỉ." }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof ApiError && error.status === 503
          ? "Hệ thống đang bận. Vui lòng thử tải lại sau."
          : error instanceof ApiError && error.status === 404
            ? "Không tìm thấy chứng chỉ."
            : "Không tải được chứng chỉ. Kiểm tra kết nối và thử lại.";
      setMessages((previous) => ({ ...previous, [id]: message }));
    } finally {
      requests.current.delete(id);
      if (!controller.signal.aborted) setBusy(new Set(requests.current.keys()));
    }
  };
  return { busy, messages, download };
}
