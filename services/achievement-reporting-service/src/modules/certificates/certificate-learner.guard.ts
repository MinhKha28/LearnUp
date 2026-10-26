import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { CertificatesService } from './certificates.service';
@Injectable()
export class CertificateLearnerGuard implements CanActivate {
  constructor(private readonly service: CertificatesService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: CurrentUser }>();
    this.service.authorize(request.user);
    return true;
  }
}
