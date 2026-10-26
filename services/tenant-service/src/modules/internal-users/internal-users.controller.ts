import { HEADER_NAMES } from '@learnup/ts-common';
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage, ServiceCall } from '../../common/decorator/customize';
import { LookupUsersDto } from './dto/lookup-users.dto';
import { InternalUsersService } from './internal-users.service';

@ApiTags('UC24.2 - Internal user lookup')
@ApiSecurity('internal-key')
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly service: InternalUsersService) {}

  @Post('lookup')
  @HttpCode(200)
  @ServiceCall()
  @ResponseMessage('Users looked up')
  @ApiOkResponse({
    description:
      'Users in the requested organization, including all roles and account states. Missing users are omitted.',
    schema: {
      type: 'object',
      required: ['statusCode', 'message', 'data'],
      properties: {
        statusCode: { type: 'integer', example: 200 },
        message: { type: 'string', example: 'Users looked up' },
        data: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'userId',
                  'role',
                  'status',
                  'activatedAt',
                  'deletedAt',
                  'fullName',
                  'email',
                ],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  role: {
                    type: 'string',
                    enum: ['Admin', 'Organizer', 'Instructor', 'Learner'],
                  },
                  status: {
                    type: 'string',
                    enum: ['Pending', 'Active', 'Deactivated'],
                  },
                  activatedAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  deletedAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  fullName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description:
      'x-organization-id is missing or differs from organizationId in the body (ORGANIZATION_NOT_FOUND).',
  })
  lookup(
    @Headers(HEADER_NAMES.ORGANIZATION_ID) organizationId: string | undefined,
    @Body() dto: LookupUsersDto,
  ) {
    return this.service.lookup(organizationId, dto);
  }
}
