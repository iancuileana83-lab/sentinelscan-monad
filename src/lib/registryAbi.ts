// Human-readable ABI of RiskRegistry. Imported only by wallet code and the server.
export const REGISTRY_ABI = [
  'function report(address subject, uint8 score, uint8 reasonCode)',
  'function retract(address subject)',
  'function getSummary(address subject) view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)',
  'function getSignal(address subject, address reporter) view returns (uint8 score, uint8 reasonCode, uint64 reportedAt)',
  'event SignalRecorded(address indexed subject, address indexed reporter, uint8 score, uint8 reasonCode, uint32 reporterCount)',
  'event SignalRetracted(address indexed subject, address indexed reporter, uint32 reporterCount)',
] as const;
