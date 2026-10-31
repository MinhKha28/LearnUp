import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { UpdatePeerReviewDto } from './dto/update-peer-review.dto';
import { PeerReviewService } from './peer-review.service';

@ApiTags('UC19.5 / UC33 - Peer Review')
@ApiSecurity('internal-key')
@Controller('assessments/assignments/:id/peer-review')
export class PeerReviewController {
  constructor(private readonly service: PeerReviewService) {}

  /** UC33 — View Peer Review Cycles */
  @Get('cycles')
  @ResponseMessage('Peer Review cycles retrieved successfully.')
  listCycles(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listCycles(user, id);
  }

  /** UC33.1 — One cycle: its submissions and the Learners who have reviews to give, with the state of their duty. */
  @Get('cycles/:cycleId')
  @ApiOperation({
    summary:
      'Read one cycle: submissions with their reviews and the reviewers with the state of their duty (UC33.1)',
  })
  @ApiNotFoundResponse({
    description:
      'CYCLE_NOT_FOUND, or the Assignment is not one of the Instructor.',
  })
  @ApiConflictResponse({
    description:
      'PEER_REVIEW_NOT_ENABLED: Peer Review is off for this Assignment.',
  })
  @ResponseMessage('Peer Review cycle retrieved successfully.')
  cycleDetail(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.service.cycleDetail(user, id, cycleId);
  }

  /** UC33 — Close a cycle and hand out the reviews (BR-242, BR-249); closing again changes nothing. */
  @Post('cycles/:cycleId/close')
  @ApiOperation({
    summary:
      'Close a cycle whose closing line has passed and which the schedule has not closed yet (UC33)',
  })
  @ApiOkResponse({
    description:
      'The cycle is closed (reviews handed out, or submissions sent to the Instructor). Closing a closed cycle answers 200 with alreadyClosed true and changes nothing.',
  })
  @ApiNotFoundResponse({
    description:
      'CYCLE_NOT_FOUND, or the Assignment is not one of the Instructor.',
  })
  @ApiConflictResponse({
    description:
      'CYCLE_NOT_DUE: the cycle has not reached its closing line (BR-230, BR-231); PEER_REVIEW_NOT_ENABLED: Peer Review is off for this Assignment.',
  })
  @HttpCode(200)
  @ResponseMessage('Peer Review cycle closed successfully.')
  closeCycle(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.service.closeCycle(user, id, cycleId);
  }

  /** UC33.2 — Waive the peer review duty of one Learner who owes it (BR-241); waiving again changes nothing. */
  @Post('learners/:learnerId/waiver')
  @ApiOperation({
    summary: 'Waive the peer review duty of a Learner who owes it (UC33.2)',
  })
  @ApiOkResponse({
    description:
      'The duty is waived and the Learner is told. Waiving a waived duty answers 200 with alreadyWaived true, the first date, and changes nothing.',
  })
  @ApiNotFoundResponse({
    description: 'The Assignment is not one of the Instructor.',
  })
  @ApiConflictResponse({
    description:
      'NOT_OWING_PEER_REVIEW: the Learner owes no peer review (reviews done, still in time, none assigned, or never took part); PEER_REVIEW_NOT_ENABLED: Peer Review is off for this Assignment.',
  })
  @HttpCode(200)
  @ResponseMessage('Peer Review duty waived successfully.')
  waiveDuty(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
  ) {
    return this.service.waiveDuty(user, id, learnerId);
  }

  /** UC19.5 — Configure Peer Review */
  @Put()
  @ResponseMessage('Peer Review settings saved successfully.')
  updateConfig(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeerReviewDto,
  ) {
    return this.service.updateConfig(user, id, dto);
  }
}
