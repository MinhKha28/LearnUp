import { v4 as uuidv4 } from 'uuid';

/**
 * CloudEvent-compatible generic event envelope for all Kafka domain events in TypeScript.
 */
export interface GenericEventEnvelope<T = unknown> {
  id: string;
  source: string;
  type: string;
  specversion: '1.0';
  datacontenttype: 'application/json';
  time: string;
  organizationId: string;
  correlationId: string;
  data: T;
}

export function createEventEnvelope<T>(params: {
  source: string;
  type: string;
  organizationId: string;
  correlationId: string;
  data: T;
  id?: string;
  time?: string;
}): GenericEventEnvelope<T> {
  return {
    id: params.id ?? uuidv4(),
    source: params.source,
    type: params.type,
    specversion: '1.0',
    datacontenttype: 'application/json',
    time: params.time ?? new Date().toISOString(),
    organizationId: params.organizationId,
    correlationId: params.correlationId,
    data: params.data,
  };
}
