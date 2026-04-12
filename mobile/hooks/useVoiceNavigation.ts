import { useCallback, useRef, useState } from "react";
import { type WebView } from "react-native-webview";

export type VoiceCommand = "next" | "previous";

/** Recognise a navigation command from a raw transcript. */
function parseCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase();
  if (/\b(next|forward|continue|ahead)\b/.test(t)) return "next";
  if (/\b(back|previous|prev|before|go back|last)\b/.test(t)) return "previous";
  return null;
}

/** Minimal HTML page that wires up the Web Speech API and talks back via postMessage. */
export const VOICE_HTML = `<!DOCTYPE html><html><head><script>
var recog = null;
try {
  recog = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recog.lang = 'en-US';
  recog.continuous = false;
  recog.interimResults = false;
  recog.maxAlternatives = 5;
  recog.onresult = function(e) {
    var list = [];
    for (var i = 0; i < e.results[0].length; i++) list.push(e.results[0][i].transcript);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', transcripts: list }));
  };
  recog.onerror = function(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: e.error }));
  };
  recog.onend = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'end' }));
  };
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
} catch(err) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'unsupported' }));
}
function startListening() { try { recog.start(); } catch(e) {} }
function stopListening()  { try { recog.stop();  } catch(e) {} }
</script></head><body style="margin:0;background:transparent;"></body></html>`;

type Options = { onCommand: (cmd: VoiceCommand) => void };

export function useVoiceNavigation({ onCommand }: Options) {
  const webViewRef = useRef<WebView>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null); // null = unknown yet
  const [error, setError] = useState<string | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  /** Called by the hidden WebView's onMessage prop. */
  const handleMessage = useCallback((raw: string) => {
    try {
      const msg: { type: string; transcripts?: string[]; error?: string } = JSON.parse(raw);
      switch (msg.type) {
        case "ready":
          setIsSupported(true);
          break;
        case "unsupported":
          setIsSupported(false);
          break;
        case "result": {
          const transcripts = msg.transcripts ?? [];
          for (const t of transcripts) {
            const cmd = parseCommand(t);
            if (cmd) {
              onCommandRef.current(cmd);
              webViewRef.current?.injectJavaScript("stopListening(); true;");
              setIsListening(false);
              setError(null);
              return;
            }
          }
          // Heard something but no matching command — keep listening indicator visible briefly
          setError(`Heard: "${transcripts[0] ?? "?"}" — try saying "next" or "back"`);
          setIsListening(false);
          break;
        }
        case "error":
          if (msg.error !== "no-speech") setError(`Recognition error: ${msg.error}`);
          setIsListening(false);
          break;
        case "end":
          setIsListening(false);
          break;
      }
    } catch {}
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    webViewRef.current?.injectJavaScript("startListening(); true;");
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    webViewRef.current?.injectJavaScript("stopListening(); true;");
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { webViewRef, handleMessage, isListening, isSupported, error, toggle };
}
