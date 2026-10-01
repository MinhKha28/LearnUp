import { Select } from "antd";
import { useEffect, useState } from "react";

import "./dev.identity.switcher.scss";

interface IdentityOption {
  key: string;
  label: string;
}

interface IdentityState {
  current: IdentityOption;
  options: IdentityOption[];
}

const ENDPOINT = "/__dev/identity";

const isIdentityState = (value: unknown): value is IdentityState => {
  const state = value as IdentityState | null;
  return (
    typeof state?.current?.key === "string" &&
    typeof state.current.label === "string" &&
    Array.isArray(state.options)
  );
};

const DevIdentitySwitcherPanel = () => {
  const [state, setState] = useState<IdentityState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(ENDPOINT, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => setState(isIdentityState(body) ? body : null))
      .catch(() => {
        if (!controller.signal.aborted) setState(null);
      });
    return () => controller.abort();
  }, []);

  if (!state) return null;

  const switchIdentity = async (key: string) => {
    setSaving(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      window.location.reload();
    } catch {
      setState(null);
    }
  };

  return (
    <div className="dev-identity-switcher">
      <span className="dev-identity-badge">Demo: {state.current.label}</span>
      <Select
        size="small"
        aria-label="Đổi danh tính demo"
        value={state.current.key}
        options={state.options.map((option) => ({ value: option.key, label: option.label }))}
        onChange={switchIdentity}
        disabled={saving}
        popupMatchSelectWidth={false}
      />
    </div>
  );
};

/**
 * Khung đổi Learner seed của proxy danh tính dev (D37). Điều kiện là hằng lúc build
 * nên bản build loại bỏ hoàn toàn phần gọi endpoint dev.
 */
export const DevIdentitySwitcher = () =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_IDENTITY_PROXY === "1" ? <DevIdentitySwitcherPanel /> : null;
