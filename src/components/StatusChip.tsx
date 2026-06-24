import type { WorkStatus } from '../domain/worknode';

interface StatusChipProps {
  status: WorkStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  return <span className={`status-chip status-${status.toLowerCase()}`}>{status}</span>;
}
