// The audible alert for admins: a two-tone siren, generated in the browser (no audio file).
// It rings for every urgent or high report until that report is acknowledged. There is no mute:
// the only way to stop it is to take the report.

let context = null;
let timer = null;
let high = false;
const active = new Set(); // reportIds still ringing

// Browsers only allow sound after a click, so the dashboard calls this from the "Start shift" button.
export function unlockAudio() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') context.resume();
  return context.state === 'running';
}

function beep() {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = high ? 880 : 660;
  gain.gain.value = 0.12;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
}

function tick() {
  if (active.size === 0) {
    clearInterval(timer);
    timer = null;
    return;
  }
  high = !high;
  beep();
}

// Ring for exactly these reports: the ones still waiting on this admin's team.
export function syncAlarms(unacknowledgedIds) {
  for (const id of [...active]) if (!unacknowledgedIds.has(id)) active.delete(id);
  for (const id of unacknowledgedIds) active.add(id);
  if (active.size > 0 && !timer) {
    timer = setInterval(tick, 700);
    tick();
  }
}

export const isRinging = () => active.size > 0;
