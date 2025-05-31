import * as mediasoupTypes from "mediasoup/node/lib/types";

export default {
  listenIp: "0.0.0.0",
  listenPort: 8088,

  transportOptions: {
    listenIps: [
      {
        ip: "0.0.0.0",
        announcedIp: "127.0.0.1",
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  } satisfies mediasoupTypes.WebRtcTransportOptions,

  mediasoup: {
    numWorkers: 1,
    worker: {
      rtcMinPort: 50000,
      rtcMaxPort: 50100,
    },

    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ] satisfies mediasoupTypes.RtpCapabilities["codecs"],
    },
  },
};
