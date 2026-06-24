import type { WorkNode } from '../domain/worknode';

export interface ReadOnlyAdapter {
  readonly id: string;
  readonly label: string;
  readonly mode: 'read-only';
  readonly allowlistedSources: readonly string[];
  loadWorkNodes(): Promise<readonly WorkNode[]>;
}

export function assertReadOnlyAdapter(adapter: ReadOnlyAdapter): void {
  if (adapter.mode !== 'read-only') {
    throw new Error(`${adapter.id} is not read-only`);
  }

  if (adapter.allowlistedSources.length === 0) {
    throw new Error(`${adapter.id} must declare at least one allowlisted source`);
  }
}

export async function loadReadOnlyWorkNodes(adapters: readonly ReadOnlyAdapter[]): Promise<WorkNode[]> {
  adapters.forEach(assertReadOnlyAdapter);
  const groups = await Promise.all(adapters.map((adapter) => adapter.loadWorkNodes()));
  return groups.flat().map((node) => ({ ...node }));
}
