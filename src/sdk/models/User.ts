import { ProducerId, RoomId, UserId } from "../types/keys";

export class User {
  constructor(
    public id: UserId, //
    public roomId: RoomId,
    public readonly producerIds: ProducerId[] = [],
  ) {}
}
