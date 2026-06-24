import worknodes from '../data/worknodes.json';
import type { WorkNode } from '../domain/worknode';
import type { ReadOnlyAdapter } from './readOnlyAdapter';

export const jsonWorkNodeAdapter: ReadOnlyAdapter = {
  id: 'json-worknodes',
  label: 'Committed WorkNode read model',
  mode: 'read-only',
  allowlistedSources: ['src/data/worknodes.json'],
  async loadWorkNodes() {
    return worknodes as WorkNode[];
  },
};
