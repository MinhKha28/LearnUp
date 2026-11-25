import type { AssessmentActivity } from '../../src/infrastructure/clients/assessment/assessment.client';

export type AppMessage =
  | {
      type: 'ready';
      url: string;
      startupMs: number;
      relay: { enabled: boolean; topic: string };
    }
  | { type: 'broker-warning'; message: string }
  | { type: 'error'; message: string }
  | { type: 'assessment-activity'; requestId: number };

export type AppCommand =
  | { type: 'stop' }
  | {
      type: 'assessment-result';
      requestId: number;
      activity?: AssessmentActivity;
      error?: string;
    };
