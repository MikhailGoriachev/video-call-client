import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalingChannel } from "../signaling/SignalingChannel";
import { SignalingChannelNotOpenError } from "../errors";
import { ServerToClientMessageType } from "../signaling/messages";
import { WebSocketEvents } from "../constants";

const dummyMessage = {
  type: ServerToClientMessageType.JOINED,
  roomId: "room1",
  userId: "user1",
};

describe("SignalingChannel", () => {
  let signaling: SignalingChannel;
  let mockWs: any;

  beforeEach(() => {
    signaling = new SignalingChannel("ws://test");
    mockWs = (signaling as any).ws;
  });

  it("should resolve immediately if socket is already open", async () => {
    mockWs.readyState = 1; // OPEN
    await expect(signaling.waitForOpen()).resolves.toBeUndefined();
  });

  it("should wait for WebSocket open event", async () => {
    const promise = signaling.waitForOpen();
    mockWs.mockOpen();
    await expect(promise).resolves.toBeUndefined();
  });

  it("should send message if socket is open", () => {
    mockWs.readyState = 1; // OPEN
    signaling.sendMessage(dummyMessage as any);
    expect(mockWs.sentMessages).toContain(JSON.stringify(dummyMessage));
  });

  it("should throw if sendMessage called while socket is not open", () => {
    expect(() => signaling.sendMessage(dummyMessage as any)).toThrow(SignalingChannelNotOpenError);
  });

  it("should emit message by type", async () => {
    const messageType = ServerToClientMessageType.JOINED;
    const message = { type: messageType, roomId: "r1", userId: "u1" };
    const handler = vi.fn();
    signaling.on(messageType, handler);
    mockWs.mockMessage(message);
    expect(handler).toHaveBeenCalledWith(message);
  });

  it("should emit open, error and close events", () => {
    const onOpen = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();

    signaling.on(WebSocketEvents.OPEN, onOpen);
    signaling.on(WebSocketEvents.ERROR, onError);
    signaling.on(WebSocketEvents.CLOSE, onClose);

    mockWs.mockOpen();
    expect(onOpen).toHaveBeenCalled();

    const fakeError = new Event("error");
    mockWs.mockError(fakeError);
    expect(onError).toHaveBeenCalledWith(fakeError);

    mockWs.mockClose();
    expect(onClose).toHaveBeenCalled();
  });

  it("should resolve waitForMessage when message of expected type is received", async () => {
    const message = dummyMessage;
    const promise = signaling.waitForMessage(ServerToClientMessageType.JOINED as any);
    mockWs.mockMessage(message);
    await expect(promise).resolves.toEqual(message);
  });
});
