let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  try {
    audioContext ??= new AudioContext();
    return audioContext;
  } catch {
    return null;
  }
}

export async function unlockOrderSound(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state !== "running") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function playOrderSound() {
  const context = getAudioContext();
  if (!context) return;

  const play = () => {
    if (context.state !== "running") return;
    const startedAt = context.currentTime;
    [1320, 1040].forEach((frequency, index) => {
      const startAt = startedAt + index * 0.2;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.17);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    });
  };

  if (context.state === "running") play();
  else void context.resume().then(play).catch(() => undefined);
}
