import { useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { googleClientId, loadGoogleIdentity } from "@/services/google.identity";
import { GOOGLE_UNAVAILABLE_MESSAGE, googleSignInMessage } from "@/utils/google.sign.in";

type Props = {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
};

export default function GoogleSignIn({ disabled, onCredential, onError }: Props) {
  const clientId = googleClientId();
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogleIdentity()
      .then((google) => {
        if (!active || !container.current) return;
        google.initialize({
          client_id: clientId,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (response.credential) callbacks.current.onCredential(response.credential);
            else callbacks.current.onError(googleSignInMessage("GOOGLE_CREDENTIAL_INVALID"));
          },
        });
        google.renderButton(container.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          locale: "vi",
          shape: "rectangular",
          logo_alignment: "center",
          width: Math.min(400, container.current.offsetWidth || 400),
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  if (!clientId) return null;

  if (failed) {
    return (
      <Button
        className="login-google"
        block
        disabled={disabled}
        onClick={() => onError(GOOGLE_UNAVAILABLE_MESSAGE)}
      >
        <span aria-hidden="true">G</span>Tiếp tục với Google
      </Button>
    );
  }

  return (
    <div
      className="login-google-gis"
      ref={container}
      aria-disabled={disabled || undefined}
      style={disabled ? { pointerEvents: "none", opacity: 0.6 } : undefined}
    />
  );
}
