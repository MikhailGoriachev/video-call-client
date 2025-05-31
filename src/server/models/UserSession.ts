import { WebSocket } from "ws";
import { AsyncQueue } from "../../utils/AsyncQueue";
import { UserId } from "../types/keys";

export type UserSessionTask = () => Promise<void>;

export class UserSession {
  constructor(
    public readonly userId: UserId, //
    public readonly socket: WebSocket,
    public readonly queue: AsyncQueue<UserSessionTask> = new AsyncQueue(),
  ) {}
}
