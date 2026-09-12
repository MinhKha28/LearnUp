import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user';

export const CURRENT_USER_KEY = 'LEARNUP_CURRENT_USER';

/**
 * Parameter decorator to inject the CurrentUser into NestJS route handlers.
 *
 * Example:
 *   @Get('profile')
 *   getProfile(@CurrentUserDecorator() user: CurrentUser) {
 *     return user;
 *   }
 */
export const CurrentUserDecorator = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext): CurrentUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUser | undefined = request?.[CURRENT_USER_KEY];
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
