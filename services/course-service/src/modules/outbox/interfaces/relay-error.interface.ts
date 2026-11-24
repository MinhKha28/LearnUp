export interface RelayErrorClassification {
  individual: boolean;
  code: string;
}

export type RelayReadiness =
  | { status: 'ready' }
  | { status: 'missing-topics'; topics: string[] }
  | { status: 'broker-failure'; code: string };
