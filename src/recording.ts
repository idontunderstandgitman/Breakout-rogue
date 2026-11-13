import { gameCanvas } from "./render";
import { isInWebView, renderMaxLevel } from "./game_utils";
import { getAudioRecordingTrack } from "./sounds";
import { t } from "./i18n/i18n";
import { GameState } from "./types";
import { isOptionOn } from "./options";
import { toast } from "./toast";

let mediaRecorder: MediaRecorder | null,
  captureStream: MediaStream,
  captureTrack: CanvasCaptureMediaStreamTrack,
  recordCanvas: HTMLCanvasElement,
  recordCanvasCtx: CanvasRenderingContext2D;

export function recordOneFrame(gameState: GameState) {
  if (!isOptionOn("record")) {
    return;
  }
  // if (!gameState.running) return;
  if (!captureStream) return;
  drawMainCanvasOnSmallCanvas(gameState);
  if (captureTrack?.requestFrame) {
    captureTrack?.requestFrame();
  } else if (captureStream?.requestFrame) {
    captureStream.requestFrame();
  }
}

export function drawMainCanvasOnSmallCanvas(gameState: GameState) {
  if (!recordCanvasCtx) return;
  recordCanvasCtx.drawImage(
    gameCanvas,
    gameState.offsetXRoundedDown,
    0,
    gameState.gameZoneWidthRoundedUp,
    gameState.gameZoneHeight,
    0,
    0,
    recordCanvas.width,
    recordCanvas.height,
  );

  // Here we don't use drawText as we don't want to cache a picture for each distinct value of score
  recordCanvasCtx.fillStyle = "#FFFFFF";
  recordCanvasCtx.textBaseline = "top";
  recordCanvasCtx.font = "12px monospace";
  recordCanvasCtx.textAlign = "right";
  recordCanvasCtx.fillText(
    gameState.score.toString(),
    recordCanvas.width - 12,
    12,
  );

  recordCanvasCtx.textAlign = "left";
  recordCanvasCtx.fillText(
    "Level " + (gameState.currentLevel + 1) + "/" + renderMaxLevel(gameState),
    12,
    12,
  );
}

export function startRecordingGame(gameState: GameState) {
  if (!isOptionOn("record")) {
    return;
  }
  if (mediaRecorder) return;
  if (!recordCanvas) {
    // Smaller canvas with fewer details
    recordCanvas = document.createElement("canvas");
    recordCanvasCtx = recordCanvas.getContext("2d", {
      antialias: false,
      alpha: false,
    }) as CanvasRenderingContext2D;

    captureStream = recordCanvas.captureStream(0);
    captureTrack =
      captureStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

    const track = getAudioRecordingTrack();
    if (track) {
      captureStream.addTrack(track.stream.getAudioTracks()[0]);
    }
  }

  recordCanvas.width = gameState.gameZoneWidthRoundedUp;
  recordCanvas.height = gameState.gameZoneHeight;

  // drawMainCanvasOnSmallCanvas()
  const recordedChunks: Blob[] = [];

  const instance = new MediaRecorder(captureStream, {
    // Required for less mushy result
    videoBitsPerSecond: 3500000,
  });
  mediaRecorder = instance;
  instance.start();
  mediaRecorder.pause();
  instance.ondataavailable = function (event) {
    recordedChunks.push(event.data);
  };

  instance.onstop = async function () {
    let targetDiv: HTMLElement | null;
    let blob = new Blob(recordedChunks, { type: "video/webm" });
    if (blob.size < 200000) return; // under 0.2MB, probably bugged out or pointlessly short

    while (
      !(targetDiv = document.getElementById("level-recording-container"))
    ) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const video = document.createElement("video");
    video.autoplay = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.width = recordCanvas.width;
    video.height = recordCanvas.height;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    video.src = URL.createObjectURL(blob);
    targetDiv.appendChild(video);

    const a = document.createElement("a");
    a.download = captureFileName("webm");
    a.target = "_blank";

    if (isInWebView) {
      a.href = await blobToBase64(blob);
    } else {
      a.href = video.src;
    }
    a.textContent = t("settings.record_download", {
      size: (blob.size / 1000000).toFixed(2),
    });
    targetDiv.appendChild(a);
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      const e = reader.error;
      console.error(e);
      toast(e?.message || "Failed to convert the video to a data url");
      reject(new Error("Failed to readAsDataURL of the video "));
    };

    reader.readAsDataURL(blob);
  });
}

export function pauseRecording() {
  if (!isOptionOn("record")) {
    return;
  }
  if (mediaRecorder?.state === "recording") {
    mediaRecorder?.pause();
  }
}

export function resumeRecording() {
  if (!isOptionOn("record")) {
    return;
  }
  if (mediaRecorder?.state === "paused") {
    mediaRecorder.resume();
  }
}

export function stopRecording() {
  if (!isOptionOn("record")) {
    return;
  }
  if (!mediaRecorder) return;
  mediaRecorder?.stop();
  mediaRecorder = null;
}

export function captureFileName(ext = "webm") {
  return (
    "breakout-71-capture-" +
    new Date().toISOString().replace(/[^0-9\-]+/gi, "-") +
    "." +
    ext
  );
}
