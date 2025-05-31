export class DeviceNotCreatedError extends Error {
  constructor() {
    super("Device not created");
  }
}

export class SendTransportNotCreatedError extends Error {
  constructor() {
    super("Send transport not created");
  }
}

export class ReceiveTransportNotCreatedError extends Error {
  constructor() {
    super("Receive transport not created");
  }
}

export class MediaTypeMustBeSelectedError extends Error {
  constructor() {
    super("Media type must be selected");
  }
}

export class SignalingChannelNotOpenError extends Error {
  constructor() {
    super("Signaling channel not open");
  }
}

export class UnexpectedMessageError extends Error {
  constructor() {
    super("Unexpected message");
  }
}
