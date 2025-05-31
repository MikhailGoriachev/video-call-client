import { UserId } from "../types/keys";
import * as mediasoupTypes from "mediasoup/node/lib/types";

export class User {
  constructor(
    public id: UserId,
    public recvTransport?: mediasoupTypes.WebRtcTransport,
    public sendTransport?: mediasoupTypes.WebRtcTransport,
    public producers: mediasoupTypes.Producer[] = [],
    public consumers: mediasoupTypes.Consumer[] = [],
  ) {}
}
