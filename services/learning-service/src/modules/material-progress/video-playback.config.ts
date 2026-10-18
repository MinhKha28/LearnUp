export const VIDEO_PLAYBACK_CONFIG = Symbol('VIDEO_PLAYBACK_CONFIG');
export interface VideoPlaybackConfig {
  mode: 'fixture' | 'course';
  fixtureUrl?: string;
}

export function readVideoPlaybackConfig(
  get: (key: string) => string | undefined,
): VideoPlaybackConfig {
  const mode = get('VIDEO_PLAYBACK_MODE')?.trim();
  if (mode !== 'fixture' && mode !== 'course')
    throw new Error('VIDEO_PLAYBACK_MODE phải là fixture hoặc course.');
  if (mode === 'course') return { mode };
  if (get('NODE_ENV') === 'production')
    throw new Error(
      'VIDEO_PLAYBACK_MODE=fixture không được dùng khi NODE_ENV=production.',
    );
  const fixtureUrl = get('VIDEO_FIXTURE_URL')?.trim();
  if (!fixtureUrl) throw new Error('Thiếu VIDEO_FIXTURE_URL.');
  const url = new URL(fixtureUrl);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('VIDEO_FIXTURE_URL phải là HTTP hoặc HTTPS.');
  return { mode, fixtureUrl };
}
