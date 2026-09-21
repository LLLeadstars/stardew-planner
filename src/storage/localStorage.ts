import type { StorageAdapter } from './adapters';
import { createStoragePort, type StoragePort } from './port';

type WebStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createLocalStorageAdapter(storage: WebStorageLike): StorageAdapter {
  return {
    read(key) {
      return storage.getItem(key);
    },
    write(key, value) {
      storage.setItem(key, value);
    },
    remove(key) {
      storage.removeItem(key);
    },
  };
}

/** 生产环境入口：使用当前浏览器的 localStorage。 */
export function createBrowserStoragePort(): StoragePort {
  return createStoragePort(createLocalStorageAdapter(window.localStorage));
}
