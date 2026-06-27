export type StreamStatus = 'Active' | 'Paused' | 'Completed';

export interface Stream {
  id: number;
  recipient: string;
  flowRatePerSecond: string;
  startTime: number;
  endTime: number;
  accumulated: string;
  lastUpdate: number;
  status: StreamStatus;
}

export type ProofType = 'payroll' | 'operational' | 'relief';

export interface Proof {
  id: number;
  proofHash: string;
  publicInputsHash: string;
  proofType: ProofType;
  timestamp: number;
  submitter: string;
}

export interface VaultStats {
  vaultBalance: string;
  totalRaised: string;
  totalDisbursed: string;
}

export interface Campaign {
  id: string;
  title: string;
  goal: string;
  metadata?: Record<string, unknown>;
}

export interface ApiError {
  error: string;
}
