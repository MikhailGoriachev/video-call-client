import { WebSocket } from "ws";
import { MediasoupServer } from "../MediasoupServer";
import {
  ClientToServerMessage,
  ClientToServerMessageType,
  DirectionType,
  ServerToClientMessage,
  ServerToClientMessageType,
} from "../messages";
import { User } from "../models/User";
import { UserSession, UserSessionTask } from "../models/UserSession";
import { ProducerId, RoomId, UserId } from "../types/keys";
import { RoomsController } from "./RoomsController";
import * as mediasoupTypes from "mediasoup/node/lib/types";
import { Logger } from "../../utils/Logger";
import { LogScopes } from "../types/logScopes";

export class AppController {
  constructor(
    private readonly mediasoupServer: MediasoupServer, //
    private readonly roomsController: RoomsController,
    private readonly userSessions: Map<UserId, UserSession> = new Map(),
  ) {}

  async handleMessage(message: ClientToServerMessage): Promise<void> {
    const userSession = this.userSessions.get(message.userId);

    switch (message.type) {
      case ClientToServerMessageType.JOIN: {
        const { rtpCapabilities } = this.join(
          message.roomId, //
          message.userId,
        );

        const users = this.roomsController.getUsersByRoom(message.roomId).map((user) => ({
          id: user.id,
          producers: user.producers.map((producer) => producer.id),
        }));

        await this.send(userSession.socket, {
          type: ServerToClientMessageType.JOINED,
          roomId: message.roomId,
          userId: message.userId,
          rtpCapabilities,
          users: users,
        });

        break;
      }
      case ClientToServerMessageType.LEAVE: {
        await this.removeUserSession(message.userId);
        break;
      }
      case ClientToServerMessageType.CREATE_TRANSPORT: {
        const transport = await this.createTransport(
          message.roomId, //
          message.userId,
          message.direction,
        );

        await this.send(userSession.socket, {
          type: ServerToClientMessageType.TRANSPORT_CREATED,
          roomId: message.roomId,
          userId: message.userId,
          direction: message.direction,
          transportOptions: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });

        break;
      }
      case ClientToServerMessageType.CONNECT_TRANSPORT: {
        const transport = await this.connectTransport(
          message.roomId, //
          message.userId,
          message.direction,
          message.dtlsParameters,
        );

        await this.send(userSession.socket, {
          type: ServerToClientMessageType.TRANSPORT_CONNECTED,
          roomId: message.roomId,
          userId: message.userId,
          direction: message.direction,
          transportId: transport.id,
        });

        break;
      }
      case ClientToServerMessageType.PRODUCE: {
        const producer = await this.produce(
          message.roomId, //
          message.userId,
          message.kind,
          message.rtpParameters,
        );

        await this.send(userSession.socket, {
          type: ServerToClientMessageType.PRODUCED,
          producerId: producer.id,
        });

        this.roomsController.getUsersByRoom(message.roomId).forEach(async (user) => {
          if (user.id === message.userId) {
            return;
          }

          const session = this.userSessions.get(user.id);

          if (!session) {
            return;
          }

          await this.send(session.socket, {
            type: ServerToClientMessageType.NEW_PRODUCER,
            roomId: message.roomId,
            userId: message.userId,
            producerId: producer.id,
          });
        });

        break;
      }
      case ClientToServerMessageType.CONSUME: {
        const consumer = await this.consume(
          message.roomId, //
          message.userId,
          message.producerId,
          message.rtpCapabilities,
        );

        await this.send(userSession.socket, {
          type: ServerToClientMessageType.CONSUMED,
          consumerOptions: {
            id: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            appData: consumer.appData,
          },
        });

        break;
      }
    }
  }

  // #region Обработчики сообщений

  join(roomId: RoomId, userId: UserId): { rtpCapabilities: mediasoupTypes.RtpCapabilities } {
    this.roomsController.getOrCreateRoom(roomId);
    this.roomsController.addUser(roomId, userId);

    return {
      rtpCapabilities: this.mediasoupServer.router.rtpCapabilities,
    };
  }

  async leave(roomId: RoomId, userId: UserId): Promise<User> {
    return this.roomsController.leaveUser(roomId, userId);
  }

  async createTransport(
    roomId: RoomId,
    userId: UserId,
    direction: DirectionType,
  ): Promise<mediasoupTypes.WebRtcTransport> {
    return this.roomsController.createUserTransport(roomId, userId, direction);
  }

  async connectTransport(roomId: RoomId, userId: UserId, direction: DirectionType, dtlsParameters: any) {
    return this.roomsController.connectUserTransport(roomId, userId, direction, dtlsParameters);
  }

  async produce(roomId: RoomId, userId: UserId, kind: mediasoupTypes.MediaKind, rtpParameters: any) {
    return this.roomsController.produce(roomId, userId, kind, rtpParameters);
  }

  async consume(
    roomId: RoomId,
    userId: UserId,
    producerId: ProducerId,
    rtpCapabilities: mediasoupTypes.RtpCapabilities,
  ) {
    return this.roomsController.consume(roomId, userId, producerId, rtpCapabilities);
  }

  // #endregion

  hasUserSession(userId: UserId) {
    return this.userSessions.has(userId);
  }

  addUserSession(userId: UserId, socket: WebSocket) {
    if (this.userSessions.has(userId)) {
      return;
    }

    const userSession = new UserSession(userId, socket);

    this.userSessions.set(userId, new UserSession(userId, socket));

    Logger.success(LogScopes.SESSION, "User session created for user", { userId });

    return userSession;
  }

  getUserSession(userId: UserId) {
    return this.userSessions.get(userId);
  }

  async removeUserSession(userId: UserId) {
    const session = this.userSessions.get(userId);

    if (!session) {
      return;
    }

    try {
      session.socket.terminate();
    } catch (error) {
      Logger.warn(LogScopes.WEB_SOCKET, "Error terminating socket for user", { userId, error });
    }

    const rooms = this.roomsController.getRoomsByUser(userId);

    for (const room of rooms) {
      await this.leave(room.id, session.userId);
    }

    session.queue.close();

    this.userSessions.delete(userId);

    Logger.warn(LogScopes.SESSION, "User session removed for user", { userId });

    for (const room of rooms) {
      room.users.forEach(async (user) => {
        const session = this.userSessions.get(user.id);

        if (!session) {
          return;
        }

        await this.send(session.socket, {
          type: ServerToClientMessageType.USER_LEFT,
          roomId: room.id,
          userId: userId,
        });
      });
    }
  }

  addUserSessionTask(userId: UserId, task: UserSessionTask) {
    const userSession = this.userSessions.get(userId);

    if (!userSession) {
      return;
    }

    userSession.queue.enqueue(task);

    this.processUserQueue(userSession);

    Logger.info(LogScopes.ASYNC_QUEUE, "User session task added for user", { userId });
  }

  private async processUserQueue(userSession: UserSession) {
    for await (const task of userSession.queue) {
      await task();
    }
  }

  async send(socket: WebSocket, message: ServerToClientMessage) {
    socket.send(JSON.stringify(message));
    Logger.info(LogScopes.WEB_SOCKET, "Message send", { type: message.type });
  }
}
