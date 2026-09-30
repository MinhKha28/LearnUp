import { PartialType } from '@nestjs/swagger';
import { CreatePeerReviewDto } from './create-peer-review.dto';

export class UpdatePeerReviewDto extends PartialType(CreatePeerReviewDto) {}
