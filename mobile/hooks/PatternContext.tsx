import { Asset } from "expo-asset";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type PatternMeta,
  type StitchInfo,
  deletePatternFile,
  ensurePatternsDir,
  loadActiveId,
  loadLibrary,
  persistPdf,
  saveActiveId,
  saveLibrary,
} from "./usePatternStorage";

type ParsedData = Pick<
  PatternMeta,
  "detectedTerms" | "steps" | "backendStitches"
>;

type PatternContextValue = {
  library: PatternMeta[];
  activeId: string | null;
  activePattern: PatternMeta | null;
  isLoaded: boolean;
  setActiveId: (id: string | null) => void;
  addPattern: (meta: PatternMeta) => void;
  updateProgress: (id: string, stepIndex: number) => void;
  updateParsedData: (id: string, data: ParsedData) => void;
  deletePattern: (id: string) => void;
};

const PatternContext = createContext<PatternContextValue | null>(null);

export function PatternProvider({ children }: { children: React.ReactNode }) {
  const [library, setLibrary] = useState<PatternMeta[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadLibrary(), loadActiveId()]).then(([lib, id]) => {
      setLibrary(lib);
      setActiveIdState(id);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveLibrary(library);
  }, [library, isLoaded]);

  // Seed the preloaded pattern on first launch
  useEffect(() => {
    if (!isLoaded) return;
    if (library.some((p) => p.id === "preloaded")) return;

    (async () => {
      try {
        const [asset] = await Asset.loadAsync(
          require("../assets/preuploaded-pattern.pdf"),
        );
        if (!asset.localUri) return;

        ensurePatternsDir();
        const pdfUri = persistPdf(asset.localUri, "preloaded");

        const meta: PatternMeta = {
          id: "preloaded",
          name: "Preuploaded: DARLEY Bag",
          addedAt: Date.now(),
          pdfUri,
          currentStepIndex: 0,
          detectedTerms: [],
          steps: [],
          backendStitches: {},
        };

        setLibrary((prev) => [meta, ...prev]);

        // Parse steps via backend
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!apiUrl) return;

        const form = new FormData();
        form.append("file", {
          uri: pdfUri,
          name: "preuploaded-pattern.pdf",
          type: "application/pdf",
        } as any);

        const resp = await fetch(`${apiUrl}/parse-file`, {
          method: "POST",
          body: form,
        });
        if (!resp.ok) return;

        const json = await resp.json();
        const map: Record<string, StitchInfo> = {};
        for (const d of json.stitch_details ?? []) {
          map[d.term] = {
            key: d.term,
            title: d.title,
            definition: d.definition,
            videoUrl: d.tutorial_url,
          };
        }

        setLibrary((prev) =>
          prev.map((p) =>
            p.id === "preloaded"
              ? {
                  ...p,
                  detectedTerms: json.unique_terms ?? [],
                  steps: json.steps ?? [],
                  backendStitches: map,
                }
              : p,
          ),
        );
      } catch (e) {
        console.log("[Preload] failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    saveActiveId(id);
  }, []);

  const addPattern = useCallback(
    (meta: PatternMeta) => {
      setLibrary((prev) => [meta, ...prev.filter((p) => p.id !== meta.id)]);
      setActiveId(meta.id);
    },
    [setActiveId],
  );

  const updateProgress = useCallback((id: string, stepIndex: number) => {
    setLibrary((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, currentStepIndex: stepIndex } : p,
      ),
    );
  }, []);

  const updateParsedData = useCallback((id: string, data: ParsedData) => {
    setLibrary((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p)),
    );
  }, []);

  const deletePattern = useCallback((id: string) => {
    deletePatternFile(id);
    setLibrary((prev) => prev.filter((p) => p.id !== id));
    setActiveIdState((prev) => {
      if (prev === id) {
        saveActiveId(null);
        return null;
      }
      return prev;
    });
  }, []);

  const activePattern = library.find((p) => p.id === activeId) ?? null;

  return (
    <PatternContext.Provider
      value={{
        library,
        activeId,
        activePattern,
        isLoaded,
        setActiveId,
        addPattern,
        updateProgress,
        updateParsedData,
        deletePattern,
      }}
    >
      {children}
    </PatternContext.Provider>
  );
}

export function usePatternContext() {
  const ctx = useContext(PatternContext);
  if (!ctx)
    throw new Error("usePatternContext must be used within PatternProvider");
  return ctx;
}
