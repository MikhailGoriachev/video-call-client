import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalingChannel } from "../core/SignalingChannel";
import { ClientToServerMessageType, ServerToClientMessageType, DirectionType } from "../types/messages";
import { UserId, RoomId, ProducerId } from "../types/keys";
import { VideoCallClient, VideoCallClientEventTypes } from "../core/VideoCallClient";

vi.mock("mediasoup-client", () => {
  return {
    types: {
      Device: vi.fn().mockImplementation(() => ({
        load: vi.fn(),
        createSendTransport: vi.fn().mockReturnValue({
          direction: DirectionType.SEND,
          on: vi.fn(),
          produce: vi.fn(),
          close: vi.fn(),
        }),
        createRecvTransport: vi.fn().mockReturnValue({
          direction: DirectionType.RECV,
          on: vi.fn(),
          consume: vi.fn(),
          close: vi.fn(),
        }),
        rtpCapabilities: {},
      })),
    },
  };
});

vi.mock("../transport/MediaManager", () => {
  return {
    MediaManager: vi.fn().mockImplementation(() => ({
      getMediaTracks: vi.fn().mockImplementation(async ({ video, audio }) => {
        const track = {} as MediaStreamTrack;
        return [track];
      }),
    })),
  };
});

describe("VideoCallClient", () => {
  let signaling: SignalingChannel;
  let client: VideoCallClient;

  const roomId: RoomId = "room-123";
  const userId: UserId = "user-abc";

  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventHandlers = {};

    signaling = {
      sendMessage: vi.fn(),
      waitForOpen: vi.fn(),
      waitForMessage: vi.fn(),
      on: vi.fn().mockImplementation((event, handler) => {
        eventHandlers[event] = handler;
      }),
    } as unknown as SignalingChannel;

    client = new VideoCallClient(signaling);

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getVideoTracks: vi.fn(() => [{ kind: "video", stop: vi.fn() }]),
          getAudioTracks: vi.fn(() => [{ kind: "audio", stop: vi.fn() }]),
          getTracks: vi.fn(() => [
            { kind: "video", stop: vi.fn() },
            { kind: "audio", stop: vi.fn() },
          ]),
        }),
      },
      configurable: true,
    });
  });

  it("should emit CONNECTED after joinCall", async () => {
    const onConnected = vi.fn();
    client.on(VideoCallClientEventTypes.CONNECTED, onConnected);

    (signaling.waitForOpen as any).mockResolvedValue(undefined);
    (signaling.sendMessage as any).mockResolvedValue(undefined);
    (signaling.waitForMessage as any).mockImplementation((type) => {
      switch (type) {
        case ServerToClientMessageType.JOINED:
          return Promise.resolve({
            rtpCapabilities: {},
            users: [],
            roomId,
          });
        case ServerToClientMessageType.TRANSPORT_CREATED:
          return Promise.resolve({
            transportOptions: {},
          });
        case ServerToClientMessageType.PRODUCED:
          return Promise.resolve({ producerId: "mock-producer-id" });
        default:
          return;
      }
    });

    await client.joinCall(roomId, userId);

    await new Promise((res) => setTimeout(res, 15));

    expect(onConnected).toHaveBeenCalled();
    expect(signaling.sendMessage).toHaveBeenCalledWith({
      type: ClientToServerMessageType.JOIN,
      roomId,
      userId,
    });
  });

  it("should emit NEW_TRACK when consumer is created", async () => {
    const onTrack = vi.fn();
    client.on(VideoCallClientEventTypes.NEW_TRACK, onTrack);

    const dummyUserId: UserId = "other-user";
    const dummyProducerId: ProducerId = "p-123";

    (signaling.sendMessage as any).mockResolvedValue(undefined);
    (signaling.waitForMessage as any).mockImplementation((type) => {
      if (type === ServerToClientMessageType.CONSUMED) {
        return Promise.resolve({
          consumerOptions: {
            id: "consumer-1",
            kind: "video",
            rtpParameters: {},
          },
        });
      }
    });

    (client as any).recvTransport = {
      consume: vi.fn().mockResolvedValue({
        track: {},
        producerId: dummyProducerId,
      }),
    };

    (client as any).device = {
      rtpCapabilities: {},
    };

    (client as any).roomId = roomId;
    (client as any).userId = userId;
    (client as any).users.set(dummyUserId, {
      id: dummyUserId,
      roomId,
      producerIds: [dummyProducerId],
    });

    await (client as any).consume(dummyProducerId, dummyUserId);

    expect(onTrack).toHaveBeenCalledWith({
      user: {
        id: dummyUserId,
        roomId,
        producerIds: [dummyProducerId],
      },
      track: {},
    });
  });
});
