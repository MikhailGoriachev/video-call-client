export class EventEmitter<TEvents extends Record<string, (...args: any[]) => void>> {
  private listeners: {
    [K in keyof TEvents]?: Set<TEvents[K]>;
  } = {};

  on<K extends keyof TEvents>(event: K, listener: any): this {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }

    this.listeners[event]!.add(listener);
    return this;
  }

  once<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    const onceListener: TEvents[K] = ((...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    }) as TEvents[K];

    return this.on(event, onceListener);
  }

  off<K extends keyof TEvents>(event: K, listener: any): this {
    this.listeners[event]?.delete(listener);
    return this;
  }

  emit<K extends keyof TEvents>(event: K, ...args: any): void {
    this.listeners[event]?.forEach((listener) => {
      listener(...args);
    });
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event) {
      this.listeners[event]?.clear();
    } else {
      (Object.keys(this.listeners) as (keyof TEvents)[]).forEach((key) => this.listeners[key]?.clear());
    }
  }
}
