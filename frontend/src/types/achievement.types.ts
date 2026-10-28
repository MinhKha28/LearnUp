export interface CertificateDetail {
  recipient: string;
  organizationName: string;
  courseTitle: string;
  versionNumber: number;
  issuedAt: string;
  issuedDate: string;
  certificateCode: string;
  completedLate: boolean;
  signerName: string | null;
  signerTitle: string | null;
}
export interface CertificateListItem {
  courseTitle: string;
  versionNumber: number;
  issuedAt: string;
  issuedDate: string;
  completedLate: boolean;
  id: string;
}
export interface CertificatePage {
  items: CertificateListItem[];
  nextCursor: string | null;
}
