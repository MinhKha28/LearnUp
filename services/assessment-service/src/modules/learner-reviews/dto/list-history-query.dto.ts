import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ListReviewsQueryDto } from './list-reviews-query.dto';

/** UC31.2: the page of the history of reviews a Learner asks for, optionally only the reviews of one Assignment. */
export class ListHistoryQueryDto extends ListReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Only the reviews given on this Assignment',
  })
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}
