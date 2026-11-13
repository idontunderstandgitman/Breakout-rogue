import { isOptionOn } from "./options";
import { GameState } from "./types";

let lastPlay = Date.now();

export function playPendingSounds(gameState: GameState) {
  if (lastPlay > Date.now() - 60) {
    return;
  }
  lastPlay = Date.now();
  for (let key in gameState.aboutToPlaySound) {
    const soundName = key as keyof GameState["aboutToPlaySound"];
    const ex = gameState.aboutToPlaySound[soundName] as {
      vol: number;
      x: number;
    };
    if (ex.vol) {
      sounds[soundName](
        //   In stress test, dim the sounds but play them
        Math.min(1, ex.vol),
        pixelsToPan(gameState, ex.x),
        gameState.combo,
      );
      ex.vol = 0;
    }
  }
}
export const sounds = {
  wallBeep: (volume: number, pan: number) => {
    if (!isOptionOn("sound")) return;

    createSingleBounceSound(800, pan, volume);
  },

  plouf: (volume: number, pan: number) => {
    if (!isOptionOn("sound")) return;
    createSingleBounceSound(500, pan, volume * 0.5);
    // createWaterDropSound(800, pan, volume*0.2, 0.2,'triangle')
  },

  comboIncreaseMaybe: (volume: number, pan: number, combo: number) => {
    if (!isOptionOn("sound")) return;

    let delta = 0;
    if (!isNaN(lastComboPlayed)) {
      if (lastComboPlayed < combo) delta = 1;
      if (lastComboPlayed > combo) delta = -1;
    }
    playShepard(delta, pan, volume);
    lastComboPlayed = combo;
  },

  comboDecrease(volume: number, pan: number, combo: number) {
    if (!isOptionOn("sound")) return;
    playShepard(-1, pan, volume);
  },
  coinBounce: (volume: number, pan: number, combo: number) => {
    if (!isOptionOn("sound")) return;
    createSingleBounceSound(1200, pan, volume, 0.1, "triangle");
  },
  explode: (volume: number, pan: number, combo: number) => {
    if (!isOptionOn("sound")) return;
    createExplosionSound(pan);
  },
  lifeLost(volume: number, pan: number, combo: number) {
    if (!isOptionOn("sound")) return;
    createShatteredGlassSound(pan);
  },

  coinCatch(volume: number, pan: number, combo: number) {
    if (!isOptionOn("sound")) return;
    createSingleBounceSound(900, pan, volume, 0.1, "triangle");
  },
  colorChange(volume: number, pan: number, combo: number) {
    createSingleBounceSound(400, pan, volume, 0.5, "sine");
    createSingleBounceSound(800, pan, volume * 0.5, 0.2, "square");
  },
};

// How to play the code on the leftconst context = new window.AudioContext();
let audioContext: AudioContext,
  audioRecordingTrack: MediaStreamAudioDestinationNode;

export function getAudioContext() {
  if (!audioContext) {
    if (!isOptionOn("sound")) return null;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioRecordingTrack = audioContext.createMediaStreamDestination();
  }
  return audioContext;
}

export function getAudioRecordingTrack() {
  getAudioContext();
  return audioRecordingTrack;
}

function createSingleBounceSound(
  baseFreq = 800,
  pan = 0.5,
  volume = 1,
  duration = 0.1,
  type: OscillatorType = "sine",
) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = createOscillator(context, baseFreq, type);

  // Create a gain node to control the volume
  const gainNode = context.createGain();
  oscillator.connect(gainNode);

  // Create a stereo panner node for left-right panning
  const panner = context.createStereoPanner();
  panner.pan.setValueAtTime(pan * 2 - 1, context.currentTime);
  gainNode.connect(panner);
  panner.connect(context.destination);
  panner.connect(audioRecordingTrack);

  // Set up the gain envelope to simulate the impact and quick decay
  gainNode.gain.setValueAtTime(0.8 * volume, context.currentTime); // Initial impact
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration,
  ); // Quick decay

  // Start the oscillator
  oscillator.start(context.currentTime);

  // Stop the oscillator after the decay
  oscillator.stop(context.currentTime + duration);
}

let noiseBuffer: AudioBuffer;

function getNoiseBuffer(context: AudioContext) {
  if (!noiseBuffer) {
    const bufferSize = context.sampleRate * 2; // 2 seconds
    noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Fill the buffer with random noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function createExplosionSound(pan = 0.5) {
  const context = getAudioContext();
  if (!context) return;
  // Create an audio buffer

  // Create a noise source
  const noiseSource = context.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(context);

  // Create a gain node to control the volume
  const gainNode = context.createGain();
  noiseSource.connect(gainNode);

  // Create a filter to shape the explosion sound
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1000, context.currentTime); // Set the initial frequency
  gainNode.connect(filter);

  // Create a stereo panner node for left-right panning
  const panner = context.createStereoPanner();
  panner.pan.setValueAtTime(pan * 2 - 1, context.currentTime); // pan 0 to 1 maps to -1 to 1

  // Connect filter to panner and then to the destination (speakers)
  filter.connect(panner);
  panner.connect(context.destination);
  panner.connect(audioRecordingTrack);

  // Ramp down the gain to simulate the explosion's fade-out
  gainNode.gain.setValueAtTime(1, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 1);

  // Lower the filter frequency over time to create the "explosive" effect
  filter.frequency.exponentialRampToValueAtTime(60, context.currentTime + 1);

  // Start the noise source
  noiseSource.start(context.currentTime);

  // Stop the noise source after the sound has played
  noiseSource.stop(context.currentTime + 1);
}

function pixelsToPan(gameState: GameState, pan: number) {
  return Math.max(
    0,
    Math.min(
      1,
      (pan - gameState.offsetXRoundedDown) / gameState.gameZoneWidthRoundedUp,
    ),
  );
}

let lastComboPlayed = NaN,
  shepard = 6;

function playShepard(delta: number, pan: number, volume: number) {
  const shepardMax = 11,
    factor = 1.05945594920268,
    baseNote = 392;
  shepard += delta;
  if (shepard > shepardMax) shepard = 0;
  if (shepard < 0) shepard = shepardMax;

  const play = (note: number) => {
    const freq = baseNote * Math.pow(factor, note);
    const diff = Math.abs(note - shepardMax * 0.5);
    const maxDistanceToIdeal = 1.5 * shepardMax;
    const vol = Math.max(0, volume * (1 - diff / maxDistanceToIdeal));
    createSingleBounceSound(freq, pan, vol);
    return freq.toFixed(2) + " at " + Math.floor(vol * 100) + "% diff " + diff;
  };

  play(1 + shepardMax + shepard);
  play(shepard);
  play(-1 - shepardMax + shepard);
}

function createShatteredGlassSound(pan: number) {
  const context = getAudioContext();
  if (!context) return;
  const oscillators = [
    createOscillator(context, 3000, "square"),
    createOscillator(context, 4500, "square"),
    createOscillator(context, 6000, "square"),
  ];
  const gainNode = context.createGain();
  const noiseSource = context.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(context);

  oscillators.forEach((oscillator) => oscillator.connect(gainNode));
  noiseSource.connect(gainNode);
  gainNode.gain.setValueAtTime(0.2, context.currentTime);
  oscillators.forEach((oscillator) => oscillator.start());
  noiseSource.start();
  oscillators.forEach((oscillator) =>
    oscillator.stop(context.currentTime + 0.2),
  );
  noiseSource.stop(context.currentTime + 0.2);
  gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);

  // Create a stereo panner node for left-right panning
  const panner = context.createStereoPanner();
  panner.pan.setValueAtTime(pan * 2 - 1, context.currentTime);
  gainNode.connect(panner);
  panner.connect(context.destination);
  panner.connect(audioRecordingTrack);

  gainNode.connect(panner);
}

// Helper function to create an oscillator with a specific frequency
export function createOscillator(
  context: AudioContext,
  frequency: number,
  type: OscillatorType,
) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  return oscillator;
}
