import { UserId, ProducerId, TransportId } from "./types/keys";

export class UserNotFoundError extends Error {
  constructor(userId: UserId) {
    super(`User not found. ID: ${userId}`);
  }
}

export class ProducerNotFoundError extends Error {
  constructor(producerId: ProducerId) {
    super(`Producer not found. ID: ${producerId}`);
  }
}

export class TransportNotFoundError extends Error {
  constructor(transportId?: TransportId) {
    super(`Transport not found. ID: ${transportId}`);
  }
}

export class CannotConsumeError extends Error {
  constructor() {
    super("Cannot consume this producer");
  }
}

export class DiedWorkerError extends Error {
  constructor() {
    super("Mediasoup worker died");
  }
}
