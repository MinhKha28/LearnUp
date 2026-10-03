import { Controller } from '@nestjs/common';
import { MaterialProgressService } from './material-progress.service';

@Controller('material-progress')
export class MaterialProgressController {
  constructor(private readonly service: MaterialProgressService) {}
}
