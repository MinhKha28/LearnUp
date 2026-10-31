import { Avatar, Image } from "antd";
import { initialsOf } from "@/hooks/use.my.profile";

interface OrganizationLogoProps {
  name: string;
  logoUrl: string | null;
}

const LOGO_SIZE = 72;

export const OrganizationLogo = ({ name, logoUrl }: OrganizationLogoProps) =>
  logoUrl ? (
    <Image
      src={logoUrl}
      alt={`${name} logo`}
      width={LOGO_SIZE}
      height={LOGO_SIZE}
      style={{ objectFit: "contain", borderRadius: 8 }}
      preview={{ mask: "View" }}
    />
  ) : (
    <Avatar shape="square" size={LOGO_SIZE}>
      {initialsOf(name)}
    </Avatar>
  );
