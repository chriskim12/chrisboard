import worknodes from '../data/worknodes.generated.json';
import { parseWorkNodes } from '../domain/worknode';
import type { ReadOnlyAdapter } from './readOnlyAdapter';

export const jsonWorkNodeAdapter: ReadOnlyAdapter = {
  id: 'json-worknodes',
  label: 'Generated source-backed WorkNode read model',
  mode: 'read-only',
  allowlistedSources: ['src/data/worknodes.generated.json', 'src/data/worknodes.provenance.json'],
  async loadWorkNodes() {
    return parseWorkNodes(worknodes);
  },
};
