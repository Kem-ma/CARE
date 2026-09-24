import { useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { getSession } from '../lib/auth';

// Keeps a WebSocket open to the alert API. The socket is only a "something just happened,
// refresh now" nudge; the dashboard's own polling remains the source of truth.
// status: 'connecting' | 'live' | 'reconnecting'
export function useAlertSocket(onAlert, enabled) {
  const [status, setStatus] = useState('connecting');
  const alertRef = useRef(onAlert);
  alertRef.current = onAlert;

  useEffect(() => {
    if (!enabled || !config.wsUrl) return undefined;

    let socket;
    let retry = 0;
    let closed = false;
    let retryTimer;
    let pingTimer;

    async function connect() {
      const session = await getSession('admin');
      if (closed || !session) return;
      // Browsers can't set headers on a WebSocket, so the access token travels in the URL.
      const token = encodeURIComponent(session.getAccessToken().getJwtToken());
      socket = new WebSocket(`${config.wsUrl}?token=${token}`);

      socket.onopen = () => {
        retry = 0;
        setStatus('live');
        // API Gateway closes idle sockets after 10 minutes, so send a small message now and then.
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'ping' }));
        }, 4 * 60 * 1000);
      };
      socket.onmessage = (event) => {
        try {
          alertRef.current(JSON.parse(event.data));
        } catch {
          // ignore anything that is not JSON
        }
      };
      socket.onclose = () => {
        clearInterval(pingTimer);
        if (closed) return;
        setStatus('reconnecting');
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
        retry += 1;
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      socket?.close();
    };
  }, [enabled]);

  return status;
}
