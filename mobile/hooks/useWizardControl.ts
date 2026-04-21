import { useCallback, useEffect, useRef, useState } from "react";

export type WizardCommand = "next" | "previous" | "back";

type Options = { onCommand: (cmd: WizardCommand) => void };

export function useWizardControl({ onCommand }: Options) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sendCommand = useCallback((cmd: "next" | "previous" | "back") => {
    console.log("[Wizard] SENDING:", cmd);
    wsRef.current?.send(cmd);
  }, []);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const connect = useCallback(() => {
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

    const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/control";
    console.log("[Wizard] API_URL =", apiUrl);
    console.log("[Wizard] WS_URL =", wsUrl);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Wizard] WS OPEN");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        console.log("[Wizard] WS MESSAGE RAW:", event.data);

        try {
          const parsed = JSON.parse(event.data);

          if (parsed.action === "next") {
            onCommandRef.current("next");
            return;
          }

          if (parsed.action === "back" || parsed.action === "previous") {
            onCommandRef.current("previous");
            return;
          }
        } catch {
          const msg = String(event.data).trim().toLowerCase();

          if (msg === "next") {
            onCommandRef.current("next");
            return;
          }

          if (msg === "previous" || msg === "back") {
            onCommandRef.current("previous");
            return;
          }
        }
      };

      ws.onerror = (e) => {
        console.log("[Wizard] WS ERROR:", e);
        setError("WebSocket error — check backend");
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("[Wizard] WS CLOSED");
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch (e) {
      console.log("[Wizard] Failed to open WebSocket:", e);
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

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { isConnected, error, connect, disconnect, toggle, sendCommand };
}