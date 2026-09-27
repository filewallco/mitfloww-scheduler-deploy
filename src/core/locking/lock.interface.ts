export interface DistributedLock {
  readonly key: string;
  readonly acquiredAt: Date;
  release(): Promise<void>;
}

export interface DistributedLockProvider {
  acquire(lockKey: string, ttlMs?: number): Promise<DistributedLock | null>;
}
