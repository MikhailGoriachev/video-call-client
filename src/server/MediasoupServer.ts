import { createWorker } from "mediasoup";
import * as mediasoupTypes from "mediasoup/node/lib/types";
import { ConsumerId, ProducerId, TransportId } from "./types/keys";
import { CannotConsumeError, DiedWorkerError, ProducerNotFoundError, TransportNotFoundError } from "./errors";
import { Logger } from "../utils/Logger";
import { LogScopes } from "./types/logScopes";

export class MediasoupServer {
  private worker: mediasoupTypes.Worker;
  private _router?: mediasoupTypes.Router;

  private transports: Map<TransportId, mediasoupTypes.Transport> = new Map();

  private producers: Map<ProducerId, mediasoupTypes.Producer> = new Map();
  private consumers: Map<ConsumerId, mediasoupTypes.Consumer> = new Map();

  get router(): mediasoupTypes.Router | undefined {
    return this._router;
  }

  constructor(
    readonly workerOptions: mediasoupTypes.WorkerSettings,
    readonly mediaCodecs: mediasoupTypes.RtpCapabilities["codecs"],
    readonly transportOptions: mediasoupTypes.WebRtcTransportOptions,
  ) {}

  async startMediasoup() {
    this.worker = await createWorker(this.workerOptions);

    this.worker.on("died", () => {
      throw new DiedWorkerError();
    });

    Logger.success(LogScopes.MEDIASOUP, "Worker created successfully", { pid: this.worker.pid });

    this._router = await this.worker.createRouter({
      mediaCodecs: this.mediaCodecs,
    });
  }

  async createTransport(): Promise<mediasoupTypes.WebRtcTransport> {
    const transport = await this._router.createWebRtcTransport(this.transportOptions);

    this.transports.set(transport.id, transport);

    return transport;
  }

  async connectTransport(transportId: TransportId, dtlsParameters: any) {
    const transport = this.transports.get(transportId);

    if (!transport) {
      throw new TransportNotFoundError(transportId);
    }

    await transport.connect({ dtlsParameters });
  }

  async createProducer(transportId: TransportId, kind: mediasoupTypes.MediaKind, rtpParameters: any) {
    const transport = this.transports.get(transportId);

    if (!transport) {
      throw new TransportNotFoundError(transportId);
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    this.producers.set(producer.id, producer);

    return producer;
  }

  async createConsumer(
    transportId: TransportId,
    producerId: ProducerId,
    rtpCapabilities: mediasoupTypes.RtpCapabilities,
  ) {
    const transport = this.transports.get(transportId);

    if (!transport) {
      throw new TransportNotFoundError(transportId);
    }

    const producer = this.producers.get(producerId);

    if (!producer) {
      throw new ProducerNotFoundError(producerId);
    }

    const isCanConsume = this.router.canConsume({
      producerId,
      rtpCapabilities,
    });

    if (!isCanConsume) {
      throw new CannotConsumeError();
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    this.consumers.set(consumer.id, consumer);

    return consumer;
  }
}
