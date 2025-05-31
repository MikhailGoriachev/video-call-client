import { vi } from "vitest";

export class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.CLOSED;
  sentMessages: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {}

  send(data: string) {
    this.sentMessages.push(data);
  }

  mockOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  mockMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  mockError(error: Event) {
    this.onerror?.(error);
  }

  mockClose() {
    this.onclose?.();
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);
