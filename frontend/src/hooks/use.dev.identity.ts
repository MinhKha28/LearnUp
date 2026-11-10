import { useEffect, useState } from "react";

export interface DevIdentityOption {
  key: string;
  label: string;
}
export interface DevIdentityState {
  current: DevIdentityOption & { organizationLabel: string; roleLabel: string };
  options: DevIdentityOption[];
}

const isIdentityState = (value: unknown): value is DevIdentityState => {
  const state = value as DevIdentityState | null;
  return typeof state?.current?.key === "string" &&
    typeof state.current.label === "string" &&
    typeof state.current.organizationLabel === "string" &&
    typeof state.current.roleLabel === "string" && Array.isArray(state.options);
};

export const useDevIdentity = () => {
  const [state, setState] = useState<DevIdentityState | null>(null);
  useEffect(() => {
    if (!(import.meta.env.DEV && import.meta.env.VITE_DEV_IDENTITY_PROXY === "1")) return;
    const controller = new AbortController();
    fetch("/__dev/identity", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then((body: unknown) => setState(isIdentityState(body) ? body : null))
      .catch(() => { if (!controller.signal.aborted) setState(null); });
    return () => controller.abort();
  }, []);
  return state;
};
