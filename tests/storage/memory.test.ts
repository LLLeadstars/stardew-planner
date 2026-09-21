import { createMemoryAdapter } from '../../src/storage/adapters';
import { describeStoragePortContract } from './contract';

describeStoragePortContract('内存适配器', {
  createAdapter: () => createMemoryAdapter(),
  reset: () => {},
});
