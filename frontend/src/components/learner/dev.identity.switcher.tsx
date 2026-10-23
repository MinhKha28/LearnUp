import { Select } from "antd";
import { useState } from "react";

import { useDevIdentity, type DevIdentityState } from "@/hooks/use.dev.identity";
import "./dev.identity.switcher.scss";

const DevIdentitySelectPanel = ({ identity }: { identity: DevIdentityState | null }) => {
  const [saving, setSaving] = useState(false);
  const state = identity;
  if (!state) return null;

  const switchIdentity = async (key: string) => {
    setSaving(true);
    try {
      const response = await fetch("/__dev/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      window.location.reload();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="dev-identity-switcher">
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

export const DevIdentitySelect = ({ identity }: { identity: DevIdentityState | null }) =>
  import.meta.env.DEV && import.meta.env.VITE_DEV_IDENTITY_PROXY === "1"
    ? <DevIdentitySelectPanel identity={identity} /> : null;

export const DevIdentitySwitcher = () => {
  const identity = useDevIdentity();
  return <DevIdentitySelect identity={identity} />;
};
