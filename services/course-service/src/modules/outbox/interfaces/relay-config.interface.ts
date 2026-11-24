export interface RelayConfig {
  enabled: boolean;
  brokers: string[];
  topic: string;
  pollMs: number;
  batchSize: number;
  deliveryMs: number;
  transactionMs: number;
  probeMs: number;
  backoffMs: number;
  backoffMaxMs: number;
  alertAttempts: number;
}
