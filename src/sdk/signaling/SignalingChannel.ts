import { ClientToServerMessage, ServerToClientMessage, ServerToClientMessageType } from "./messages";
import { SignalingChannelNotOpenError } from "../errors";
import { WebSocketEvents } from "../constants";
import { EventEmitter } from "../../utils/EventEmmiter";
import { Logger } from "../../utils/Logger";
import { LogScopes } from "../types/logScropes";

export type SignalingChannelEvents =
  | {
      [K in ServerToClientMessageType]: (message: Extract<ServerToClientMessage, { type: K }>) => void;
    } & {
      [WebSocketEvents.OPEN]: () => void;
      [WebSocketEvents.CLOSE]: () => void;
      [WebSocketEvents.ERROR]: (error: Event) => void;
    };

export class SignalingChannel extends EventEmitter<SignalingChannelEvents> {
  private readonly ws: WebSocket;

  constructor(url: string) {
    super();

    this.ws = new WebSocket(url);

    this.ws.onopen = this.onOpenHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onerror = this.onErrorHandler.bind(this);
    this.ws.onclose = this.onCloseHandler.bind(this);
  }

  waitForOpen(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        return resolve();
      }

      this.once(WebSocketEvents.OPEN, () => {
        resolve();
      });
    });
  }

  sendMessage(message: ClientToServerMessage) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new SignalingChannelNotOpenError();
    }

    Logger.success(LogScopes.WEB_SOCKET, `Message send`, {
      type: message.type,
      roomId: message.roomId,
      userId: message.userId,
    });
    this.ws.send(JSON.stringify(message));
  }

  private onMessageHandler(event: MessageEvent) {
    const data: ServerToClientMessage = JSON.parse(event.data);

    if (data.type) {
      Logger.success(LogScopes.WEB_SOCKET, `Message receive`, { type: data.type });
      this.emit(data.type, data);
    }
  }

  private onOpenHandler() {
    Logger.success(LogScopes.WEB_SOCKET, "Connection opened");
    this.emit(WebSocketEvents.OPEN);
  }

  private onErrorHandler(error: Event) {
    Logger.error(LogScopes.WEB_SOCKET, "WebSocket error", error);
    this.emit(WebSocketEvents.ERROR, error);
  }

  private onCloseHandler() {
    Logger.warn(LogScopes.WEB_SOCKET, "Connection closed");
    this.emit(WebSocketEvents.CLOSE);
  }

  waitForMessage<
    T extends ServerToClientMessageType, //
    K extends Extract<ServerToClientMessage, { type: T }>,
  >(type: T): Promise<K> {
    return new Promise((resolve) => {
      const handler = (message: K) => {
        this.off(type, handler);
        resolve(message);
      };

      this.on(type, handler);
    });
  }
}
