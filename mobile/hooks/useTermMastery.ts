import { useCallback, useEffect, useRef, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";

const MASTERY_THRESHOLD = 5;

export type MasteryLevel = "new" | "learning" | "mastered";

type TermRecord = {
  tapCount: number;
  stepsPassedWithoutTap: number;
};

type MasteryStore = Record<string, TermRecord>;

function masteryFile(): File {
  const dir = new Directory(Paths.document, "data");
  if (!dir.exists) dir.create();
  return new File(dir.uri + "termMastery.json");
}

function getLevel(rec: TermRecord | undefined): MasteryLevel {
  if (!rec) return "new";
  if (rec.stepsPassedWithoutTap >= MASTERY_THRESHOLD) return "mastered";
  if (rec.tapCount > 0) return "learning";
  return "new";
}

export function useTermMastery() {
  const [store, setStore] = useState<MasteryStore>({});
  const storeRef = useRef<MasteryStore>({});

  // Load from file on mount (text() is async)
  useEffect(() => {
    const file = masteryFile();
    if (!file.exists) return;
    file.text().then((raw) => {
      try {
        const parsed: MasteryStore = JSON.parse(raw);
        storeRef.current = parsed;
        setStore(parsed);
      } catch {}
    });
  }, []);

  const persist = useCallback((updated: MasteryStore) => {
    storeRef.current = updated;
    setStore({ ...updated });
    try {
      masteryFile().write(JSON.stringify(updated)); // write() is synchronous
    } catch {}
  }, []);

  const recordTap = useCallback((term: string) => {
    const updated = { ...storeRef.current };
    const rec = updated[term] ?? { tapCount: 0, stepsPassedWithoutTap: 0 };
    updated[term] = { tapCount: rec.tapCount + 1, stepsPassedWithoutTap: 0 };
    persist(updated);
  }, [persist]);

  const recordStepLeft = useCallback((
    stepTerms: string[],
    tappedTerms: ReadonlySet<string>,
  ) => {
    if (stepTerms.length === 0) return;
    const updated = { ...storeRef.current };
    for (const term of stepTerms) {
      if (tappedTerms.has(term)) continue;
      const rec = updated[term] ?? { tapCount: 0, stepsPassedWithoutTap: 0 };
      updated[term] = { ...rec, stepsPassedWithoutTap: rec.stepsPassedWithoutTap + 1 };
    }
    persist(updated);
  }, [persist]);

  const getMasteryLevel = useCallback((term: string): MasteryLevel => {
    return getLevel(storeRef.current[term]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]); // re-create when store state changes so callers see fresh levels

  return { store, getMasteryLevel, recordTap, recordStepLeft };
}
