import config from "./config";
import { AppController } from "./core/AppController";
import { RoomsController } from "./core/RoomsController";
import {
  WebSocket, //
  WebSocketServer,
} from "ws";
import { Logger } from "../utils/Logger";
import { LogScopes } from "./types/logScopes";
import { ClientToServerMessage } from "./types/messages";
import { MediasoupServer } from "./core/MediasoupServer";

(async () => {
  const mediasoupServer = new MediasoupServer(
    config.mediasoup.worker,
    config.mediasoup.router.mediaCodecs,
    config.transportOptions,
  );

  mediasoupServer.startMediasoup();

  const roomsController = new RoomsController(mediasoupServer);
  const appController = new AppController(mediasoupServer, roomsController);

  const wss = new WebSocketServer({ port: config.listenPort });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (message) => {
      try {
        const data: ClientToServerMessage = JSON.parse(message.toString());

        const { userId } = data;

        if (!userId) {
          return;
        }

        let session = appController.getUserSession(userId);

        if (!session) {
          ws["userId"] = userId;
          session = appController.addUserSession(userId, ws);
        }

        appController.addUserSessionTask(userId, () => appController.handleMessage(data));
      } catch (error) {
        Logger.error(LogScopes.WEB_SOCKET, "Error handling message", { message: error.message });
      }
    });

    ws.on("close", () => {
      appController.removeUserSession(ws["userId"]);
    });
  });
})();
