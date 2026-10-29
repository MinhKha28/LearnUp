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
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
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

  /** UC33 — Close a cycle and hand out the reviews (BR-242, BR-249); closing again changes nothing. */
  @Post('cycles/:cycleId/close')
  @HttpCode(200)
  @ResponseMessage('Peer Review cycle closed successfully.')
  closeCycle(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.service.closeCycle(user, id, cycleId);
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
