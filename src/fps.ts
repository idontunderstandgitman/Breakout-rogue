import { mainGameState } from "./game";
import { sumOfValues } from "./game_utils";
import { getCurrentMaxCoins, getCurrentMaxParticles } from "./settings";
import { clamp, liveCount } from "./pure_functions";

export let total: Record<string, number> = {};
let lastTick = performance.now();
export let lastMeasuredFPS = 60;
let secondsBelow30FPS = 0,
  secondsAbove30FPS = 0;

export function frameStarted() {
  FPSCounter++;
}

let doing = "idle";
export function startWork(what: string) {
  if (mainGameState.startParams.runType !== "stress") return;
  const newNow = performance.now();
  if (doing) {
    total[doing] = (total[doing] || 0) + (newNow - lastTick);
  }
  lastTick = newNow;
  doing = what;
}

export function isPerformanceTerrible() {
  const yes = secondsBelow30FPS > secondsAbove30FPS;
  secondsBelow30FPS = 0;
  secondsAbove30FPS = 0;
  return yes;
}

export let FPSCounter = 0;
export const stats = document.getElementById("stats") as HTMLDivElement;
setInterval(() => {
  lastMeasuredFPS = FPSCounter;
  FPSCounter = 0;
  // Tab could be in the background otherwise, no point in measure fps then
  if (mainGameState.running) {
    if (lastMeasuredFPS > 30) {
      secondsAbove30FPS++;
    } else {
      secondsBelow30FPS++;
    }
  }

  if (mainGameState.startParams.runType !== "stress") {
    stats.style.display = "none";
    return;
  }
  stats.style.display = "block";
  const totalTime = sumOfValues(total);
  stats.innerHTML =
    `
    <div> 
    ${lastMeasuredFPS} FPS -
    ${liveCount(mainGameState.coins)} / ${getCurrentMaxCoins()} Coins - 
     ${liveCount(mainGameState.particles) + liveCount(mainGameState.lights) + liveCount(mainGameState.texts)} / ${getCurrentMaxParticles() * 3} particles 
    </div>  
    ` +
    Object.entries(total)
      // .sort((a, b) => b[1] - a[1])
      .map(
        (t) =>
          `  <div> 
           <div style="transform: scale(${clamp(t[1] / totalTime, 0, 1)},1)"></div> 
  <strong>${t[0]} : ${Math.floor(t[1])} ms</strong> 
  </div>
        `,
      )
      .join("\n");
  total = {};
}, 1000);
