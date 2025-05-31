import { RoomId, UserId } from "../types/keys";
import * as mediasoupTypes from "mediasoup/node/lib/types";
import { User } from "./User";

export class Room {
  constructor(
    public id: RoomId, //
    public router: mediasoupTypes.Router,
    public users: Map<UserId, User> = new Map(),
  ) {}
}
