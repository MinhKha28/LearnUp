// UC05.1 - Sign in with Google: loads Google Identity Services (GIS) and returns its ID API.
// The ID token (credential) is handed to Identity, which verifies it; the browser never trusts it.

export const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

export type GoogleCredentialResponse = { credential?: string };

export type GoogleAccountsId = {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill";
      width?: number;
      logo_alignment?: "left" | "center";
    },
  ): void;
};

type GoogleWindow = { google?: { accounts?: { id?: GoogleAccountsId } } };

/** The public OAuth web client ID; empty means Google sign-in is not configured for this build. */
export const googleClientId = (): string =>
  (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

let pending: Promise<GoogleAccountsId> | null = null;

/** Loads the GIS script once; rejects (and allows a later retry) if it cannot be loaded. */
export function loadGoogleIdentity(
  doc: Document = document,
  win: GoogleWindow = window as unknown as GoogleWindow,
): Promise<GoogleAccountsId> {
  const ready = win.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  pending = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = win.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error("Google Identity Services did not initialise"));
    };
    script.onerror = () => reject(new Error("Google Identity Services could not be loaded"));
    doc.head.appendChild(script);
  }).catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

/** Test hook: forget a cached load attempt. */
export function resetGoogleIdentityLoader(): void {
  pending = null;
}
