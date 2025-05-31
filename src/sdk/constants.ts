export enum Bitrate {
  LOW = 150_000,
  MEDIUM = 500_000,
  HIGH = 1_200_000,
}

export const VIDEO_GOOGLE_START_BITRATE = 1_000;

export enum WebSocketEvents {
  OPEN = "open",
  MESSAGE = "message",
  CLOSE = "close",
  ERROR = "error",
}
