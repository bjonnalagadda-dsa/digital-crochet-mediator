import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  type PatternMeta,
  deletePatternFile,
  loadActiveId,
  loadLibrary,
  saveActiveId,
  saveLibrary,
} from "./usePatternStorage";

type ParsedData = Pick<PatternMeta, "detectedTerms" | "steps" | "backendStitches">;

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

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    saveActiveId(id);
  }, []);

  const addPattern = useCallback(
    (meta: PatternMeta) => {
      setLibrary((prev) => [meta, ...prev.filter((p) => p.id !== meta.id)]);
      setActiveId(meta.id);
    },
    [setActiveId]
  );

  const updateProgress = useCallback((id: string, stepIndex: number) => {
    setLibrary((prev) =>
      prev.map((p) => (p.id === id ? { ...p, currentStepIndex: stepIndex } : p))
    );
  }, []);

  const updateParsedData = useCallback((id: string, data: ParsedData) => {
    setLibrary((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
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
  if (!ctx) throw new Error("usePatternContext must be used within PatternProvider");
  return ctx;
}
