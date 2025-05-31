import { types as mediasoupTypes } from "mediasoup-client";
import { SignalingChannel } from "./SignalingChannel";
import {
  ProducerId, //
  RoomId,
  UserId,
} from "../types/keys";
import {
  ClientToServerMessageType, //
  DirectionType,
  ServerToClientMessageType,
} from "../types/messages";
import {
  DeviceNotCreatedError, //
  ReceiveTransportNotCreatedError,
  SendTransportNotCreatedError,
} from "../errors";
import { Bitrate, VIDEO_GOOGLE_START_BITRATE } from "../constants";
import { MediaManager } from "./MediaManager";
import { User } from "../models/User";
import { AsyncQueue } from "../../utils/AsyncQueue";
import { EventEmitter } from "../../utils/EventEmmiter";

export enum VideoCallClientEventTypes {
  CONNECTED = "connected",
  ERROR = "error",
  NEW_TRACK = "newTrack",
  USER_LEFT = "userLeft",
}

export type VideoCallClientEvents = {
  [VideoCallClientEventTypes.CONNECTED]: () => void;
  [VideoCallClientEventTypes.ERROR]: (err: Error) => void;
  [VideoCallClientEventTypes.NEW_TRACK]: (user: User, track: MediaStreamTrack) => void;
  [VideoCallClientEventTypes.USER_LEFT]: (user: User) => void;
};

export class VideoCallClient extends EventEmitter<VideoCallClientEvents> {
  private readonly signaling: SignalingChannel;
  private device: mediasoupTypes.Device = new mediasoupTypes.Device();

  private userId: UserId;
  private roomId: RoomId;
  private consumers: mediasoupTypes.Consumer[] = [];
  private producers: mediasoupTypes.Producer[] = [];

  private sendTransport?: mediasoupTypes.Transport;
  private recvTransport?: mediasoupTypes.Transport;

  public readonly users: Map<UserId, User> = new Map();

  private asyncQueue: AsyncQueue<() => Promise<void>> = new AsyncQueue();

  constructor(signaling: SignalingChannel) {
    super();
    this.signaling = signaling;
    this.startProcessingTasks();
  }

  async joinCall(roomId: RoomId, userId: UserId): Promise<void> {
    if (this.userId) {
      return;
    }

    this.roomId = roomId;
    this.userId = userId;

    this.asyncQueue.enqueue(async () => {
      await this.signaling.waitForOpen();
    });

    this.asyncQueue.enqueue(async () => {
      await this.signaling.sendMessage({ type: ClientToServerMessageType.JOIN, roomId, userId });
    });

    this.asyncQueue.enqueue(async () => {
      const message = await this.signaling.waitForMessage(ServerToClientMessageType.JOINED);
      this.device.load({ routerRtpCapabilities: message.rtpCapabilities });

      message.users.forEach((user) => {
        this.users.set(user.id, new User(user.id, message.roomId, user.producers));
      });
    });

    this.asyncQueue.enqueue(async () => {
      this.sendTransport = await this.createTransport(DirectionType.SEND);
    });

    this.asyncQueue.enqueue(async () => {
      await this.connectTransport(this.sendTransport);
    });

    this.asyncQueue.enqueue(async () => {
      this.recvTransport = await this.createTransport(DirectionType.RECV);
    });

    this.asyncQueue.enqueue(async () => {
      await this.connectTransport(this.recvTransport);
    });

    this.asyncQueue.enqueue(async () => {
      await this.produceVideo();
    });

    this.asyncQueue.enqueue(async () => {
      await this.produceAudio();
    });

    this.asyncQueue.enqueue(async () => {
      this.users.forEach((user) =>
        user.producerIds.forEach((producerId) => {
          this.asyncQueue.enqueue(async () => {
            await this.consume(producerId, user.id);
          });
        }),
      );
    });

    this.signaling.on(ServerToClientMessageType.TRANSPORT_CONNECTED, async ({ roomId, userId, producerId }) => {});

    this.signaling.on(ServerToClientMessageType.NEW_PRODUCER, async ({ roomId, userId, producerId }) => {
      if (roomId !== this.roomId || userId === this.userId) {
        return;
      }

      const user = this.users.get(userId);

      if (user) {
        if (user.producerIds.includes(producerId)) {
          return;
        } else {
          user.producerIds.push(producerId);
        }
      } else {
        this.users.set(userId, new User(userId, roomId, [producerId]));
      }

      this.asyncQueue.enqueue(async () => {
        await this.consume(producerId, userId);
      });
    });

    this.signaling.on(ServerToClientMessageType.USER_LEFT, async ({ roomId, userId }) => {
      if (roomId !== this.roomId) {
        return;
      }

      const user = this.users.get(userId);

      if (!user) {
        return;
      }

      this.users.delete(userId);

      this.asyncQueue.enqueue(async () => {
        const consumers = this.consumers.filter((consumer) => user.producerIds.includes(consumer.producerId));
        await Promise.all(consumers.map((consumer) => consumer.close()));
      });

      this.emit(VideoCallClientEventTypes.USER_LEFT, { user });
    });

    this.emit(VideoCallClientEventTypes.CONNECTED);
  }

  async leaveCall() {
    this.asyncQueue.enqueue(async () => {
      await this.signaling.sendMessage({
        type: ClientToServerMessageType.LEAVE,
        roomId: this.roomId,
        userId: this.userId,
      });

      await Promise.all(this.consumers.map((consumer) => consumer.close()));
      await Promise.all(this.producers.map((producer) => producer.close()));

      this.consumers = [];
      this.producers = [];

      this.sendTransport.close();
      this.recvTransport.close();

      this.sendTransport = null;
      this.recvTransport = null;

      this.users.clear();
    });
  }

  private async createTransport(direction: DirectionType): Promise<mediasoupTypes.Transport> {
    if (!this.device) {
      throw new DeviceNotCreatedError();
    }

    await this.signaling.sendMessage({
      type: ClientToServerMessageType.CREATE_TRANSPORT,
      roomId: this.roomId,
      userId: this.userId,
      direction: direction,
    });

    const transportMessage = await this.signaling.waitForMessage(ServerToClientMessageType.TRANSPORT_CREATED);

    return direction === DirectionType.SEND
      ? this.device.createSendTransport(transportMessage.transportOptions)
      : this.device.createRecvTransport(transportMessage.transportOptions);
  }

  private async connectTransport(transport: mediasoupTypes.Transport): Promise<void> {
    transport.on("connect", async ({ dtlsParameters }, callback) => {
      await this.signaling.sendMessage({
        type: ClientToServerMessageType.CONNECT_TRANSPORT,
        roomId: this.roomId,
        userId: this.userId,
        direction: transport.direction as DirectionType,
        dtlsParameters,
      });
      callback();
    });

    if (transport.direction === DirectionType.SEND) {
      transport.on("produce", async ({ kind, rtpParameters }, callback) => {
        await this.signaling.sendMessage({
          type: ClientToServerMessageType.PRODUCE,
          roomId: this.roomId,
          userId: this.userId,
          kind: kind,
          rtpParameters: rtpParameters,
        });

        const { producerId } = await this.signaling.waitForMessage(ServerToClientMessageType.PRODUCED);

        callback({ id: producerId });
      });
    }
  }

  private async produceVideo(): Promise<void> {
    if (!this.device) {
      throw new DeviceNotCreatedError();
    }

    if (!this.sendTransport) {
      throw new SendTransportNotCreatedError();
    }

    const videoTrack = (await new MediaManager().getMediaTracks({ video: true }))[0];

    const producer = await this.sendTransport.produce({
      track: videoTrack,
      encodings: [
        {
          maxBitrate: Bitrate.LOW,
        },
        {
          maxBitrate: Bitrate.MEDIUM,
        },
        {
          maxBitrate: Bitrate.HIGH,
        },
      ],
      codecOptions: {
        videoGoogleStartBitrate: VIDEO_GOOGLE_START_BITRATE,
      },
    });

    this.producers.push(producer);
  }

  private async produceAudio(): Promise<void> {
    if (!this.device) {
      throw new DeviceNotCreatedError();
    }

    if (!this.sendTransport) {
      throw new SendTransportNotCreatedError();
    }

    const audioTrack = (await new MediaManager().getMediaTracks({ audio: true }))[0];

    const producer = await this.sendTransport.produce({
      track: audioTrack,
    });

    this.producers.push(producer);
  }

  private async consume(producerId: ProducerId, userId: UserId): Promise<void> {
    if (!this.device) {
      throw new DeviceNotCreatedError();
    }

    if (!this.recvTransport) {
      throw new ReceiveTransportNotCreatedError();
    }

    this.signaling.sendMessage({
      type: ClientToServerMessageType.CONSUME,
      roomId: this.roomId,
      userId: this.userId,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });

    const consumeResponse = await this.signaling.waitForMessage(ServerToClientMessageType.CONSUMED);

    const consumer = await this.recvTransport.consume({
      id: consumeResponse.consumerOptions.id,
      producerId,
      kind: consumeResponse.consumerOptions.kind,
      rtpParameters: consumeResponse.consumerOptions.rtpParameters,
    });

    this.consumers.push(consumer);

    this.emit(VideoCallClientEventTypes.NEW_TRACK, {
      user: this.users.get(userId)!,
      track: consumer.track,
    });
  }

  private async startProcessingTasks() {
    for await (const task of this.asyncQueue) {
      await task();
    }
  }
}
