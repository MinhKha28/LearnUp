import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ResponseMessage,
  ServiceCall,
  ServiceOrganization,
} from '../../common/decorator/customize';
import { CompletionSnapshotService } from './completion-snapshot.service';

@ApiTags('Internal - completion snapshot (CT-1)')
@ApiSecurity('internal-key')
@Controller('internal/learners/:learnerId/courses/:courseId')
export class CompletionSnapshotController {
  constructor(private readonly service: CompletionSnapshotService) {}

  /**
   * For learning-service only (never through the gateway): did the Learner finish every Quiz and Assignment the Course
   * requires? The caller sends `x-internal-key` and `x-organization-id`, no user. `organizationId` in the query is
   * optional; when sent it must match the header, otherwise the Learner is not found in that Organization (404).
   */
  @ServiceCall()
  @Get('completion-snapshot')
  @ResponseMessage('Completion snapshot retrieved successfully.')
  getSnapshot(
    @ServiceOrganization() organizationId: string,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('organizationId') queryOrganizationId?: string,
  ) {
    if (
      queryOrganizationId !== undefined &&
      queryOrganizationId !== organizationId
    ) {
      throw new NotFoundException('Learner not found.');
    }
    return this.service.getSnapshot(organizationId, learnerId, courseId);
  }
}
