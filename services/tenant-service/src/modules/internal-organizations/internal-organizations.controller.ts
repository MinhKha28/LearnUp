import { HEADER_NAMES } from '@learnup/ts-common';
import { Controller, Get, Headers, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseMessage, ServiceCall } from '../../common/decorator/customize';
import { InternalOrganizationsService } from './internal-organizations.service';

const organizationHeader = ApiHeader({
  name: HEADER_NAMES.ORGANIZATION_ID,
  required: true,
  description: 'Organization of the caller; must equal :organizationId.',
});
const organizationNotFound = ApiNotFoundResponse({
  description:
    'x-organization-id is missing or differs from :organizationId, or the Organization does not exist (ORGANIZATION_NOT_FOUND).',
});

@ApiTags('Internal - Organizations')
@ApiSecurity('internal-key')
@Controller('internal/organizations')
export class InternalOrganizationsController {
  constructor(private readonly service: InternalOrganizationsService) {}

  @Get(':organizationId/access')
  @ServiceCall()
  @ResponseMessage('Organization access checked')
  @ApiOperation({
    summary:
      'Access state of an Organization for learning and achievement-reporting (BR-22, BR-23, BR-24, BR-55).',
  })
  @organizationHeader
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['statusCode', 'message', 'data'],
      properties: {
        statusCode: { type: 'integer', example: 200 },
        message: { type: 'string', example: 'Organization access checked' },
        data: {
          type: 'object',
          required: [
            'organizationId',
            'organizationStatus',
            'subscriptionStatus',
            'readOnlyEndsAt',
            'timezone',
          ],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
            organizationStatus: {
              type: 'string',
              enum: ['PendingPayment', 'Active', 'Suspended', 'Cancelled'],
            },
            subscriptionStatus: {
              type: 'string',
              enum: ['Active', 'Grace', 'Suspended', 'Ended'],
              description: 'Current Subscription; Ended when there is none.',
            },
            readOnlyEndsAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'Only when Suspended: end of the Organizer read-only window (BR-24).',
            },
            timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: ':organizationId is not a UUID.' })
  @organizationNotFound
  access(
    @Headers(HEADER_NAMES.ORGANIZATION_ID)
    headerOrganizationId: string | undefined,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.service.access(headerOrganizationId, organizationId);
  }

  @Get(':organizationId/certificate-profile')
  @ServiceCall()
  @ResponseMessage('Certificate profile fetched')
  @ApiOperation({
    summary:
      'Organization name, logo and timezone that achievement-reporting freezes into a Certificate (#148; BR-263, BR-270).',
  })
  @organizationHeader
  @ApiOkResponse({
    description:
      'Returned regardless of Organization status. logo is null only when the Organization has no logo.',
    schema: {
      type: 'object',
      required: ['statusCode', 'message', 'data'],
      properties: {
        statusCode: { type: 'integer', example: 200 },
        message: { type: 'string', example: 'Certificate profile fetched' },
        data: {
          type: 'object',
          required: ['organizationId', 'name', 'logo', 'timezone'],
          properties: {
            organizationId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            logo: {
              type: 'object',
              nullable: true,
              required: ['url', 'expiresAt', 'mimeType', 'sizeBytes'],
              properties: {
                url: { type: 'string', format: 'uri' },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                mimeType: { type: 'string', nullable: true },
                sizeBytes: { type: 'integer', nullable: true },
              },
            },
            timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: ':organizationId is not a UUID.' })
  @organizationNotFound
  @ApiServiceUnavailableResponse({
    description:
      'The Organization has a logo but its URL cannot be built (STORAGE_UNAVAILABLE).',
  })
  certificateProfile(
    @Headers(HEADER_NAMES.ORGANIZATION_ID)
    headerOrganizationId: string | undefined,
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.service.certificateProfile(
      headerOrganizationId,
      organizationId,
    );
  }
}
