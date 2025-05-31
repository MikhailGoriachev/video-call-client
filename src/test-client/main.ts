import { VideoCallClient, SignalingChannel, User, keys, VideoCallClientEventTypes } from "@sdk";

const signalingHost = "127.0.0.1";
const signalingPort = 8088;

let signaling = new SignalingChannel(`ws://${signalingHost}:${signalingPort}/ws`);
let client = new VideoCallClient(signaling);

const joinBtn = document.getElementById("joinBtn") as HTMLButtonElement;
const leaveBtn = document.getElementById("leaveBtn") as HTMLButtonElement;
const remoteVideos = document.getElementById("videoGrid") as HTMLDivElement;
const localVideo = document.getElementById("localVideo") as HTMLVideoElement;

window.addEventListener("load", () => {
  if (!joinBtn || !leaveBtn || !remoteVideos || !localVideo) {
    throw new Error("Not found necessary DOM elements");
  }

  leaveBtn.hidden = true;

  const localStream: MediaStream | null = null;
  const userStreams: Map<keys.UserId, MediaStream> = new Map();

  const roomId = "test-room";
  const userId = `user-${Math.floor(Math.random() * 10000)}`;

  joinBtn.addEventListener("click", () => joinCallHandler(localStream, roomId, userId));
  leaveBtn.addEventListener("click", () => leaveCallHandler(localStream, userStreams));

  joinCallHandler(localStream, roomId, userId);

  setLocalId(userId);
});

async function setLocalId(userId: keys.UserId) {
  const label = document.createElement("div");
  label.textContent = `Me (ID: ${userId})`;
  label.style.position = "absolute";
  label.style.bottom = "0.5rem";
  label.style.left = "0.5rem";
  label.style.color = "white";
  label.style.background = "rgba(0, 0, 0, 0.5)";
  label.style.padding = "0.2rem 0.6rem";
  label.style.borderRadius = "0.4rem";
  label.style.fontSize = "0.9rem";

  const container = localVideo.parentElement;
  if (container) {
    container.appendChild(label);
  }
}

async function joinCallHandler(
  localStream: MediaStream, //
  roomId: string,
  userId: string,
  userStreams: Map<keys.UserId, MediaStream> = new Map(),
) {
  joinBtn.hidden = true;
  leaveBtn.hidden = false;

  signaling = new SignalingChannel(`ws://${signalingHost}:${signalingPort}/ws`);
  client = new VideoCallClient(signaling);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  localVideo.srcObject = localStream;
  localVideo.muted = true;
  await localVideo.play();

  client.on(VideoCallClientEventTypes.NEW_TRACK, ({ user, track }) => {
    addRemoteTrack(user, track, userStreams, remoteVideos);
  });

  client.on(VideoCallClientEventTypes.USER_LEFT, ({ user }) => {
    handleUserLeft(user, userStreams, remoteVideos);
  });

  await client.joinCall(roomId, userId);
}

async function leaveCallHandler(
  localStream: MediaStream, //
  userStreams: Map<keys.UserId, MediaStream>,
) {
  await client.leaveCall();

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (localVideo) {
    localVideo.pause();
    localVideo.srcObject = null;
  }

  remoteVideos.querySelectorAll("[data-user-id]").forEach((el) => el.remove());

  userStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });

  userStreams.clear();

  joinBtn.hidden = false;
  leaveBtn.hidden = true;
}

function addRemoteTrack(
  user: User,
  track: MediaStreamTrack,
  userStreams: Map<keys.UserId, MediaStream>,
  remoteVideos?: HTMLDivElement,
) {
  if (!remoteVideos) return;

  let wrapper = remoteVideos.querySelector(`div[data-user-id="${user.id}"]`) as HTMLDivElement | null;

  if (!wrapper) {
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.setAttribute("data-user-id", user.id);
      wrapper.className = "video-container";

      const videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("data-user-id", user.id);

      wrapper.appendChild(videoEl);

      const label = document.createElement("div");
      label.textContent = `ID: ${user.id}`;
      label.style.position = "absolute";
      label.style.bottom = "0.5rem";
      label.style.left = "0.5rem";
      label.style.color = "white";
      label.style.background = "rgba(0, 0, 0, 0.5)";
      label.style.padding = "0.2rem 0.6rem";
      label.style.borderRadius = "0.4rem";
      label.style.fontSize = "0.9rem";

      wrapper.appendChild(label);
      remoteVideos.appendChild(wrapper);
    }
  }

  const videoEl = wrapper.querySelector("video") as HTMLVideoElement;

  let stream = userStreams.get(user.id);
  if (!stream) {
    stream = new MediaStream();
    userStreams.set(user.id, stream);
    videoEl.srcObject = stream;
  }

  const trackExists = stream.getTracks().some((item) => item.id === track.id);
  if (!trackExists) {
    stream.addTrack(track);
  }
}

function handleUserLeft(
  user: User, //
  userStreams: Map<keys.UserId, MediaStream>,
  remoteVideos?: HTMLDivElement,
) {
  if (!remoteVideos) return;

  const videoWrapper = remoteVideos.querySelector(`div[data-user-id="${user.id}"]`);
  if (videoWrapper) {
    videoWrapper.remove();
  }

  const stream = userStreams.get(user.id);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    userStreams.delete(user.id);
  }
}
