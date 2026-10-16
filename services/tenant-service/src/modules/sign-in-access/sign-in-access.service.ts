import { Injectable } from '@nestjs/common';
import {
  DAY_MS,
  OrganizationStatus,
  SubscriptionStatus,
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';
import {
  ISignInAccess,
  SignInAccessMode,
  SignInDenyReason,
} from './interfaces/sign-in-access.interface';
import { SignInAccessRepository } from './sign-in-access.repository';

const ORGANIZER_READ_ONLY_DAYS = 30;

const allow = (accessMode: SignInAccessMode): ISignInAccess => ({
  allowed: true,
  accessMode,
  reason: null,
});

const deny = (reason: SignInDenyReason): ISignInAccess => ({
  allowed: false,
  accessMode: null,
  reason,
});

@Injectable()
export class SignInAccessService {
  constructor(
    private readonly signInAccessRepository: SignInAccessRepository,
  ) {}

  async check(userId: string): Promise<ISignInAccess> {
    const user =
      await this.signInAccessRepository.findUserWithOrganization(userId);
    if (!user || user.deletedAt) return deny('ACCOUNT_NOT_FOUND');
    if (user.status === UserStatus.Pending) return deny('ACCOUNT_NOT_ACTIVE');
    if (user.status !== UserStatus.Active) return deny('ACCOUNT_DEACTIVATED');

    if (user.role === UserRoleValue.Admin) return allow('Full');

    const organization = user.organization;
    if (!organization) return deny('ORGANIZATION_NOT_ACTIVE');
    if (organization.status === OrganizationStatus.Suspended) {
      return deny('ORGANIZATION_SUSPENDED');
    }
    if (organization.status !== OrganizationStatus.Active) {
      return deny('ORGANIZATION_NOT_ACTIVE');
    }

    const subscription =
      await this.signInAccessRepository.findCurrentSubscription(
        organization.id,
      );
    if (!subscription) return deny('SUBSCRIPTION_ENDED');

    if (
      subscription.status === SubscriptionStatus.Active ||
      subscription.status === SubscriptionStatus.Grace
    ) {
      return allow('Full');
    }

    if (user.role !== UserRoleValue.Organizer) {
      return deny('SUBSCRIPTION_SUSPENDED');
    }
    const readOnlyEndsAt =
      subscription.readOnlyEndsAt ??
      (subscription.suspendedAt
        ? new Date(
            subscription.suspendedAt.getTime() +
              ORGANIZER_READ_ONLY_DAYS * DAY_MS,
          )
        : null);
    return readOnlyEndsAt && readOnlyEndsAt.getTime() > Date.now()
      ? allow('ReadOnly')
      : deny('SUBSCRIPTION_SUSPENDED');
  }
}
