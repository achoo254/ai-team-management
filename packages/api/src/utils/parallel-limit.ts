/** Run async tasks with concurrency limit */
export async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const cleanup = () => { executing.splice(executing.indexOf(p), 1) }
    const p = fn(item).then(cleanup, cleanup)
    executing.push(p)
    if (executing.length >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}
