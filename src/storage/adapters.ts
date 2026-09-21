/**
 * 存储适配器：端口最底层的键值读写。
 * 内存适配器与 localStorage 适配器只负责“怎么存”，端口负责“存什么、怎么校验”。
 */
export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemoryAdapter(initial?: Record<string, string>): StorageAdapter {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    read(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    write(key, value) {
      store.set(key, value);
    },
    remove(key) {
      store.delete(key);
    },
  };
}
