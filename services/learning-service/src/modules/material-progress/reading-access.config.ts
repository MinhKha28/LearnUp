import { readVideoPlaybackConfig } from './video-playback.config';

export const READING_ACCESS_CONFIG = Symbol('READING_ACCESS_CONFIG');
export type ReadingAccessConfig = ReturnType<typeof readReadingAccessConfig>;

/** Course mode is safe by default and does not contact course-service at startup. */
export function readReadingAccessConfig(
  get: (key: string) => string | undefined,
) {
  try {
    return readVideoPlaybackConfig((key) => {
      if (key === 'VIDEO_PLAYBACK_MODE')
        return get('READING_ACCESS_MODE') ?? 'course';
      if (key === 'VIDEO_FIXTURE_URL') return get('READING_FIXTURE_URL');
      return get(key);
    });
  } catch (error) {
    if (error instanceof Error)
      throw new Error(
        error.message
          .replaceAll('VIDEO_PLAYBACK_MODE', 'READING_ACCESS_MODE')
          .replaceAll('VIDEO_FIXTURE_URL', 'READING_FIXTURE_URL'),
      );
    throw error;
  }
}
