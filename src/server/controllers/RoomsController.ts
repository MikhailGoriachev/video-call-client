import * as mediasoupTypes from "mediasoup/node/lib/types";
import { ProducerId, RoomId, UserId } from "../types/keys";
import { Room } from "../models/Room";
import { MediasoupServer } from "../MediasoupServer";
import { User } from "../models/User";
import { TransportNotFoundError, UserNotFoundError } from "../errors";
import { DirectionType } from "../messages";
import { Logger } from "../../utils/Logger";
import { LogScopes } from "../types/logScopes";

export class RoomsController {
  rooms: Map<RoomId, Room> = new Map();

  constructor(private readonly mediasoupServer: MediasoupServer) {}

  getOrCreateRoom(roomId: RoomId): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const router = this.mediasoupServer.router;

    const room = new Room(roomId, router);

    this.rooms.set(roomId, room);

    Logger.success(LogScopes.ROOM, "Room created", { roomId });

    return room;
  }

  addUser(roomId: RoomId, userId: UserId): User {
    const room = this.getOrCreateRoom(roomId);

    if (room.users.has(userId)) {
      return room.users.get(userId);
    }

    const user: User = new User(userId);

    room.users.set(userId, user);

    Logger.success(LogScopes.ROOM, "User added to room", { roomId, userId });

    return user;
  }

  leaveUser(roomId: RoomId, userId: UserId): User {
    const room = this.getOrCreateRoom(roomId);

    const user = room.users.get(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.consumers.forEach((consumer) => consumer.close());

    user.producers.forEach((producer) => {
      producer.close();

      for (const user of room.users.values()) {
        user.consumers.filter((consumer) => {
          if (consumer.producerId === producer.id) {
            consumer.close();
          }

          return consumer.producerId !== producer.id;
        });
      }
    });

    user.recvTransport?.close();
    user.sendTransport?.close();

    room.users.delete(userId);

    Logger.warn(LogScopes.ROOM, "User left room", { roomId, userId });

    return user;
  }

  getUser(roomId: RoomId, userId: UserId): User | undefined {
    return this.rooms.get(roomId)?.users.get(userId);
  }

  getUsersByRoom(roomId: RoomId): User[] {
    const users = this.rooms.get(roomId)?.users.values();
    return users ? Array.from(users) : [];
  }

  getRoomsByUser(userId: UserId): Room[] {
    const rooms = [];

    for (const room of this.rooms.values()) {
      if (room.users.has(userId)) {
        rooms.push(room);
      }
    }

    return rooms;
  }

  async createUserTransport(
    roomId: RoomId,
    userId: UserId,
    direction: DirectionType,
  ): Promise<mediasoupTypes.WebRtcTransport> {
    const user = this.getUser(roomId, userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const transport = await this.mediasoupServer.createTransport();

    if (direction === DirectionType.SEND) {
      user.sendTransport = transport;
    } else {
      user.recvTransport = transport;
    }

    Logger.success(LogScopes.ROOM, "User transport created", { roomId, userId });

    return transport;
  }

  async connectUserTransport(
    roomId: RoomId,
    userId: UserId,
    direction: DirectionType,
    dtlsParameters: any,
  ): Promise<mediasoupTypes.WebRtcTransport> {
    const user = this.getUser(roomId, userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const transport =
      direction === DirectionType.SEND //
        ? user.sendTransport
        : user.recvTransport;

    if (!transport) {
      throw new TransportNotFoundError();
    }

    await this.mediasoupServer.connectTransport(transport.id, dtlsParameters);

    Logger.success(LogScopes.ROOM, `User transport connected`, {
      roomId,
      userId,
    });

    return transport;
  }

  async produce(
    roomId: RoomId,
    userId: UserId,
    kind: mediasoupTypes.MediaKind,
    rtpParameters: any,
  ): Promise<mediasoupTypes.Producer> {
    const user = this.getUser(roomId, userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    if (!user.sendTransport) {
      throw new TransportNotFoundError();
    }

    const producer = await this.mediasoupServer.createProducer(user.sendTransport.id, kind, rtpParameters);

    user.producers.push(producer);

    Logger.success(LogScopes.ROOM, "User producer created", { roomId, userId });

    return producer;
  }

  async consume(
    roomId: RoomId,
    userId: UserId,
    producerId: ProducerId,
    rtpCapabilities: mediasoupTypes.RtpCapabilities,
  ): Promise<mediasoupTypes.Consumer> {
    const user = this.getUser(roomId, userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    if (!user.recvTransport) {
      throw new TransportNotFoundError();
    }

    const consumer = await this.mediasoupServer.createConsumer(user.recvTransport.id, producerId, rtpCapabilities);

    user.consumers.push(consumer);

    Logger.success(LogScopes.ROOM, "User consumer created", {
      roomId,
      userId,
    });

    return consumer;
  }
}
