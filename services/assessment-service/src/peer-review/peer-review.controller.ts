import { Controller } from '@nestjs/common';
import { PeerReviewService } from './peer-review.service';

@Controller('peer-review')
export class PeerReviewController {
  constructor(private readonly service: PeerReviewService) {}
}
