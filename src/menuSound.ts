// The menu needs to be separated from gameplay audio recording
import { isOptionOn } from "./options";
import { createOscillator } from "./sounds";

let menuAudioContext: AudioContext, timeout: NodeJS.Timeout;

function getMenuAudioContext() {
  if (!menuAudioContext) {
    menuAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (timeout) {
    clearTimeout(timeout);
  }
  menuAudioContext.resume();
  timeout = setTimeout(() => menuAudioContext.suspend(), 1000);

  return menuAudioContext;
}

let lastClick = 0;
export function menuClick() {
  const duration = 0.1;
  if (lastClick > Date.now() - 100) return;
  lastClick = Date.now();
  if (!isOptionOn("sound") || !isOptionOn("menu_sound")) return;
  const context = getMenuAudioContext();
  if (!context) return;
  const oscillator = createOscillator(context, 300, "sine");

  // Create a gain node to control the volume
  const gainNode = context.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  // Set up the gain envelope to simulate the impact and quick decay
  gainNode.gain.setValueAtTime(0.0001, context.currentTime); // Initial impact
  gainNode.gain.exponentialRampToValueAtTime(
    0.8,
    context.currentTime + duration / 10,
  ); // Initial impact
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration,
  ); // Quick decay

  // Start the oscillator
  oscillator.start(context.currentTime);

  // Stop the oscillator after the decay
  oscillator.stop(context.currentTime + duration);
}
