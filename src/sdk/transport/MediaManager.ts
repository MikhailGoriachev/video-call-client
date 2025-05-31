import { MediaTypeMustBeSelectedError } from "../errors";

export type AudioMediaOption = { audio: boolean };
export type VideoMediaOption = { video: boolean };

export type MediaOptions =
  | {
      audio: true;
      video?: boolean;
    }
  | {
      audio?: boolean;
      video: true;
    };

export class MediaManager {
  private stream?: MediaStream;

  async getMediaTracks(mediaType: MediaOptions): Promise<MediaStreamTrack[]> {
    this.stream ??= await navigator.mediaDevices.getUserMedia(mediaType);

    if (!mediaType.audio && !mediaType.video) {
      throw new MediaTypeMustBeSelectedError();
    }

    const tracks = [];

    if (mediaType.audio) {
      const [audio] = this.stream.getAudioTracks();

      if (audio) {
        tracks.push(audio);
      }
    }

    if (mediaType.video) {
      const [video] = this.stream.getVideoTracks();

      if (video) {
        tracks.push(video);
      }
    }

    return tracks;
  }
}
