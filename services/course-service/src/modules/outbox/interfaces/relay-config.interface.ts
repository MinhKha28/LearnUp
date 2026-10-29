export interface RelayConfig {
  enabled: boolean;
  brokers: string[];
  topic: string;
  replicationFactor: number;
  pollMs: number;
  batchSize: number;
  deliveryMs: number;
  transactionMs: number;
  probeMs: number;
  backoffMs: number;
  backoffMaxMs: number;
  alertAttempts: number;
}
