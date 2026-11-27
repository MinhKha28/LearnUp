export interface RelayErrorClassification {
  individual: boolean;
  code: string;
}

/**
 * `code` is why the probe failed. `rebuildCode` is set only when the clients were then rebuilt
 * and that rebuild failed too; it never replaces `code`.
 */
export type RelayReadiness =
  | { status: 'ready' }
  | { status: 'missing-topics'; topics: string[] }
  | { status: 'broker-failure'; code: string; rebuildCode?: string };
