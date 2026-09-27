/**
 * Splits an array into chunks of the given size.
 * Safe for bounded memory processing.
 */
export function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) throw new Error("chunkSize must be greater than 0");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Executes an async task over items in batches with bounded concurrency.
 */
export async function processInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  handler: (batch: T[]) => Promise<R>
): Promise<R[]> {
  const chunks = chunkArray(items, batchSize);
  const results: R[] = [];
  for (const chunk of chunks) {
    const res = await handler(chunk);
    results.push(res);
  }
  return results;
}
