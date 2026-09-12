import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const SKIP_RESPONSE_TRANSFORM_KEY = 'learnup:skip_response_transform';

/**
 * Decorator to bypass automatic ApiResponse wrapping (e.g. for file streaming, metrics, health checks).
 */
export const SkipResponseTransform = (): CustomDecorator<string> =>
  SetMetadata(SKIP_RESPONSE_TRANSFORM_KEY, true);
