export type SignInAccessMode = 'Full' | 'ReadOnly';

export type SignInDenyReason =
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'ACCOUNT_DEACTIVATED'
  | 'ORGANIZATION_SUSPENDED'
  | 'ORGANIZATION_NOT_ACTIVE'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'SUBSCRIPTION_ENDED';

export interface ISignInAccess {
  allowed: boolean;
  accessMode: SignInAccessMode | null;
  reason: SignInDenyReason | null;
}
