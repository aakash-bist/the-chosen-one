let audioCtx: AudioContext | null = null;
const buffers: Record<string, AudioBuffer> = {};

export async function loadSounds() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  const files: Record<string, string> = {
    add: "/sounds/add.mp3",
    remove: "/sounds/remove.mp3",
    win: "/sounds/win.mp3",
  };

  await Promise.all(
    Object.entries(files).map(async ([key, url]) => {
      const res = await fetch(url);
      const arrayBuf = await res.arrayBuffer();
      buffers[key] = await audioCtx!.decodeAudioData(arrayBuf);
    })
  );

  console.log("✅ Sounds preloaded");
}

export function playSound(name: keyof typeof buffers) {
  if (!audioCtx || !buffers[name]) return;

  const src = audioCtx.createBufferSource();
  src.buffer = buffers[name];

  const gain = audioCtx.createGain();
  gain.gain.value = 0.6;

  src.connect(gain).connect(audioCtx.destination);
  src.start(0);
}
