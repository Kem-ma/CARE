import { useEffect, useState } from 'react';

// Seconds left until `deadline` (a Date.now() value), ticking once a second. The deadline is
// worked out from the server's "seconds left", so a phone with a wrong clock still counts right.
export function useCountdown(deadline) {
  const left = () => (deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
  const [seconds, setSeconds] = useState(left);

  useEffect(() => {
    setSeconds(left());
    if (!deadline) return undefined;
    const timer = setInterval(() => {
      const next = left();
      setSeconds(next);
      if (next === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return seconds;
}

export const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
