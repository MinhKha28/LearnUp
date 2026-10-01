import { Body, Controller, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../common/decorator/customize';
import { UpdatePeerReviewDto } from './dto/update-peer-review.dto';
import { PeerReviewService } from './peer-review.service';

@ApiTags('UC19.5 - Peer Review')
@ApiSecurity('internal-key')
@Controller('assessments/assignments/:id/peer-review')
export class PeerReviewController {
  constructor(private readonly service: PeerReviewService) {}

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
