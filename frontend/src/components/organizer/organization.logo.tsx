import { Avatar, Image } from "antd";
import { useRef, useState } from "react";
import { initialsOf } from "@/hooks/use.my.profile";
import "./organization.logo.scss";

interface OrganizationLogoProps {
  name: string;
  logoUrl: string | null;
}

const LOGO_SIZE = 72;

export const OrganizationLogo = ({ name, logoUrl }: OrganizationLogoProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  if (!logoUrl) {
    return (
      <Avatar shape="square" size={LOGO_SIZE}>
        {initialsOf(name)}
      </Avatar>
    );
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="organization-logo-button"
        aria-label={`View a larger logo of ${name}`}
        onClick={() => setPreviewOpen(true)}
      >
        <img
          src={logoUrl}
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="organization-logo-image"
        />
      </button>
      <Image
        wrapperStyle={{ display: "none" }}
        src={logoUrl}
        alt={`${name} logo`}
        preview={{
          visible: previewOpen,
          onVisibleChange: (visible) => {
            setPreviewOpen(visible);
            if (!visible) trigger.current?.focus();
          },
        }}
      />
    </>
  );
};
