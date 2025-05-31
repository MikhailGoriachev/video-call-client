export class AsyncQueue<T extends () => Promise<void>> {
  private queue: T[] = [];
  private resolvers: ((value: IteratorResult<T>) => void)[] = [];
  private done = false;

  enqueue(item: T) {
    if (this.resolvers.length) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close() {
    this.done = true;
    this.resolvers.forEach((resolve) => resolve({ value: undefined, done: true }));
    this.resolvers = [];
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.queue.length > 0) {
      return { value: this.queue.shift()!, done: false };
    }

    if (this.done) {
      return { value: undefined, done: true };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      this.resolvers.push(resolve);
    });
  }
}
