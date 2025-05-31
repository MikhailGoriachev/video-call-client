import { ConsumerId, ProducerId, RoomId, TransportId, UserId } from "../types/keys";
import { types as mediasoupTypes } from "mediasoup-client";

export enum ClientToServerMessageType {
  JOIN = "join",
  LEAVE = "leave",
  CREATE_TRANSPORT = "createTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
  ROOM_USERS = "roomUsers",
}

export enum ServerToClientMessageType {
  JOINED = "joined",
  USER_LEFT = "user-left",
  TRANSPORT_CREATED = "transportCreated",
  TRANSPORT_CONNECTED = "transportConnected",
  PRODUCED = "produced",
  NEW_PRODUCER = "newProducer",
  CONSUMED = "consumed",
  ERROR = "error",
}

export enum DirectionType {
  SEND = "send",
  RECV = "recv",
}

export type ClientToServerMessage =
  | { type: ClientToServerMessageType.JOIN; roomId: RoomId; userId: UserId }
  | { type: ClientToServerMessageType.LEAVE; roomId: RoomId; userId: UserId }
  | { type: ClientToServerMessageType.CREATE_TRANSPORT; roomId: RoomId; userId: UserId; direction: DirectionType }
  | {
      type: ClientToServerMessageType.CONNECT_TRANSPORT;
      roomId: RoomId;
      userId: UserId;
      direction: DirectionType;
      dtlsParameters: any;
    }
  | {
      type: ClientToServerMessageType.PRODUCE;
      roomId: RoomId;
      userId: UserId;
      kind: mediasoupTypes.MediaKind;
      rtpParameters: any;
    }
  | {
      type: ClientToServerMessageType.CONSUME;
      roomId: RoomId;
      userId: UserId;
      producerId: ProducerId;
      rtpCapabilities: mediasoupTypes.RtpCapabilities;
    }
  | {
      type: ClientToServerMessageType.CONSUME;
      roomId: RoomId;
      userId: UserId;
      producerId: ProducerId;
      rtpCapabilities: mediasoupTypes.RtpCapabilities;
    };

export type ServerToClientMessage =
  | {
      type: ServerToClientMessageType.JOINED;
      roomId: RoomId;
      userId: UserId;
      rtpCapabilities: mediasoupTypes.RtpCapabilities;
      users: {
        id: UserId;
        producers: ProducerId[];
      }[];
    }
  | { type: ServerToClientMessageType.USER_LEFT; roomId: RoomId; userId: UserId }
  | {
      type: ServerToClientMessageType.TRANSPORT_CREATED;
      roomId: RoomId;
      userId: UserId;
      direction: DirectionType;
      transportOptions: mediasoupTypes.TransportOptions;
    }
  | {
      type: ServerToClientMessageType.TRANSPORT_CONNECTED;
      roomId: RoomId;
      userId: UserId;
      direction: DirectionType;
      transportId: TransportId;
    }
  | {
      type: ServerToClientMessageType.NEW_PRODUCER;
      roomId: RoomId;
      userId: UserId;
      producerId: ProducerId;
    }
  | { type: ServerToClientMessageType.PRODUCED; producerId: ProducerId }
  | { type: ServerToClientMessageType.CONSUMED; consumerOptions: ConsumerOptions }
  | { type: ServerToClientMessageType.ERROR; message: string };

export type ConsumerOptions = {
  id: ConsumerId;
  producerId: ProducerId;
  kind: mediasoupTypes.MediaKind;
  rtpParameters: mediasoupTypes.RtpParameters;
  appData: mediasoupTypes.AppData;
};
