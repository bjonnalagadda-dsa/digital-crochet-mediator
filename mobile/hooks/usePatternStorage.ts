import { Directory, File, Paths } from "expo-file-system";

export type StitchInfo = {
  key: string;
  title: string;
  definition: string;
  videoUrl: string;
};

export type Step = { text: string; terms: string[] };

export type PatternMeta = {
  id: string;
  name: string;
  addedAt: number;
  pdfUri: string;
  currentStepIndex: number;
  detectedTerms: string[];
  steps: Step[];
  backendStitches: Record<string, StitchInfo>;
};

// ── Directory helpers ────────────────────────────────────────────────────────

function getPatternsDir(): Directory {
  return new Directory(Paths.document, "patterns");
}

function getDataDir(): Directory {
  const dir = new Directory(Paths.document, "data");
  if (!dir.exists) dir.create();
  return dir;
}

function dataFile(name: string): File {
  return new File(getDataDir().uri + name);
}

function getPatternFile(id: string): File {
  return new File(getPatternsDir().uri + id + ".pdf");
}

// ── PDF helpers (synchronous) ────────────────────────────────────────────────

export function ensurePatternsDir(): void {
  const dir = getPatternsDir();
  if (!dir.exists) dir.create();
}

export function persistPdf(cacheUri: string, id: string): string {
  ensurePatternsDir();
  const dest = getPatternFile(id);
  new File(cacheUri).copy(dest);
  return dest.uri;
}

export function deletePatternFile(id: string): void {
  const file = getPatternFile(id);
  if (file.exists) file.delete();
}

// ── JSON storage (async File API) ────────────────────────────────────────────

export async function loadLibrary(): Promise<PatternMeta[]> {
  try {
    const file = dataFile("library.json");
    if (!file.exists) return [];
    const raw = await file.text();
    const library: PatternMeta[] = JSON.parse(raw);
    return library.map((p) => ({
      ...p,
      pdfUri: p.pdfUri && new File(p.pdfUri).exists ? p.pdfUri : "",
    }));
  } catch {
    return [];
  }
}

export async function saveLibrary(library: PatternMeta[]): Promise<void> {
  try {
    dataFile("library.json").write(JSON.stringify(library));
  } catch {}
}

export async function loadActiveId(): Promise<string | null> {
  try {
    const file = dataFile("activeId.txt");
    if (!file.exists) return null;
    const val = (await file.text()).trim();
    return val || null;
  } catch {
    return null;
  }
}

export async function saveActiveId(id: string | null): Promise<void> {
  try {
    const file = dataFile("activeId.txt");
    if (id === null) {
      if (file.exists) file.delete();
    } else {
      file.write(id);
    }
  } catch {}
}
