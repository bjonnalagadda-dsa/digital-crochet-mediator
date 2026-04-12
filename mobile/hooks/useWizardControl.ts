import { useCallback, useEffect, useRef, useState } from "react";

export type WizardCommand = "next" | "previous";

type Options = { onCommand: (cmd: WizardCommand) => void };

/**
 * Wizard of Oz control hook.
 *
 * Connects to the FastAPI backend WebSocket at /ws/control.
 * When the researcher clicks Next or Back on the control page
 * (http://<IP>:8000/control), the server broadcasts the command
 * and this hook fires onCommand on the participant's phone.
 */
export function useWizardControl({ onCommand }: Options) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const connect = useCallback(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    // Convert http(s):// to ws(s)://
    const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/control";

    // Close any existing socket before reconnecting
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        const msg = event.data?.trim();
        if (msg === "next" || msg === "previous") {
          onCommandRef.current(msg);
        }
      };

      ws.onerror = () => {
        setError("WebSocket error — check backend");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch (e) {
      setError("Failed to open WebSocket");
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const toggle = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { isConnected, error, connect, disconnect, toggle };
}
