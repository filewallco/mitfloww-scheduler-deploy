import { describe, it, expect } from "vitest";
import { chunkArray, processInBatches } from "../../src/utils/batch.js";

describe("batch utilities", () => {
  it("chunks array correctly when divisible", () => {
    const arr = [1, 2, 3, 4];
    const chunks = chunkArray(arr, 2);
    expect(chunks).toEqual([[1, 2], [3, 4]]);
  });

  it("chunks array correctly with remainder", () => {
    const arr = [1, 2, 3, 4, 5];
    const chunks = chunkArray(arr, 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles empty array", () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it("throws on invalid chunk size", () => {
    expect(() => chunkArray([1], 0)).toThrow();
    expect(() => chunkArray([1], -1)).toThrow();
  });

  it("processInBatches processes all chunks sequentially", async () => {
    const arr = [1, 2, 3, 4, 5];
    const processed: number[][] = [];
    await processInBatches(arr, 2, async (batch) => {
      processed.push(batch);
      return batch.length;
    });
    expect(processed).toEqual([[1, 2], [3, 4], [5]]);
  });
});
