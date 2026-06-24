import { mockWorkNodes } from '../data/mockWorkNodes';
import type { ReadOnlyAdapter } from './readOnlyAdapter';

export const mockAdapter: ReadOnlyAdapter = {
  id: 'mock-proof',
  label: 'Mock WorkNode coverage set',
  mode: 'read-only',
  allowlistedSources: ['src/data/mockWorkNodes.ts'],
  async loadWorkNodes() {
    return mockWorkNodes;
  },
};
