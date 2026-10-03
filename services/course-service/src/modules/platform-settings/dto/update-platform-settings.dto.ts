import { PartialType } from '@nestjs/swagger';
import { CreatePlatformSettingDto } from './create-platform-settings.dto';

export class UpdatePlatformSettingDto extends PartialType(CreatePlatformSettingDto) {}
