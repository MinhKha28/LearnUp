export interface IVerificationEmailParams {
  fullName: string;
  organizationName: string;
  code: string;
  codeTtlMinutes: number;
  reopenLink: string;
  registrationExpiresAt: Date;
}

export interface IReopenLinkEmailParams {
  fullName: string;
  organizationName: string;
  reopenLink: string;
  registrationExpiresAt: Date;
}

export interface IAccountExistsEmailParams {
  fullName: string;
  loginUrl: string;
  forgotPasswordUrl: string;
}

export interface IOrganizerActivatedEmailParams {
  fullName: string;
  organizationName: string;
  planName: string;
  subscriptionExpiresAt: Date;
  loginUrl: string;
}
