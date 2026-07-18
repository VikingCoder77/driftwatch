export async function mapConcurrent<T, Result>(
  items: T[],
  concurrency: number,
  callback: (item: T, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }

  const results = new Array<Result>(items.length);
  let nextIndex = 0;
  let failed = false;
  let failure: unknown;

  async function worker(): Promise<void> {
    while (!failed) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await callback(items[index] as T, index);
      } catch (error) {
        failed = true;
        failure = error;
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (failed) {
    throw failure;
  }
  return results;
}
