import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** The options the Learner has chosen for one question; an empty list clears the answer. */
export class SaveAnswerDto {
  @ApiProperty({
    type: [String],
    description:
      'Ids of the chosen options. One for a single-choice or true/false question, any number for a multiple-choice one; [] clears the answer.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds!: string[];
}
