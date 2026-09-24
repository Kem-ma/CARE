import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORD_SECONDS = 180;

function pickMime() {
  if (!window.MediaRecorder) return '';
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) || ''
  );
}

// Records from the microphone. `onFinish({ blob, mime, seconds })` runs when recording stops.
export function useRecorder(onFinish) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorder = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);
  const timer = useRef(null);
  const elapsed = useRef(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const release = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => release, [release]);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError('');
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setError('rec.unsupported');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('rec.blocked');
      return;
    }

    const mimeType = pickMime();
    const instance = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    elapsed.current = 0;
    setSeconds(0);

    instance.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    instance.onstop = () => {
      release();
      setRecording(false);
      const type = instance.mimeType || mimeType || 'audio/webm';
      finishRef.current({ blob: new Blob(chunks.current, { type }), mime: type, seconds: elapsed.current });
    };

    recorder.current = instance;
    instance.start();
    setRecording(true);
    timer.current = setInterval(() => {
      elapsed.current += 1;
      setSeconds(elapsed.current);
      if (elapsed.current >= MAX_RECORD_SECONDS) stop();
    }, 1000);
  }, [release, stop]);

  return { recording, seconds, error, start, stop };
}
