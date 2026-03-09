import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

/** ===== Types ===== */
type StitchInfo = {
  key: string;
  title: string;
  definition: string;
  videoUrl: string;
};

type Step = { text: string; terms: string[] };

/** ===== Helpers ===== */
function normalizeTerm(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function toEmbedUrl(url: string): string {
  let m = url.match(/youtube\.com\/shorts\/([^?&]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/youtu\.be\/([^?&]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/[?&]v=([^&]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return url;
}

/** ===== Stitch Knowledge Base ===== */
const STITCH_LIBRARY: { [key: string]: StitchInfo } = {
  ch: {
    key: "ch",
    title: "Chain (ch)",
    definition: "Yarn over and pull through the loop on your hook.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  dc: {
    key: "dc",
    title: "Double Crochet (dc)",
    definition: "Yarn over, insert hook, pull up loop, yarn over pull through 2, yarn over pull through 2.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
  hdc: {
    key: "hdc",
    title: "Half Double Crochet (hdc)",
    definition: "Yarn over, insert hook, pull up loop, yarn over, pull through all 3 loops.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  "sl st": {
    key: "sl st",
    title: "Slip Stitch (sl st)",
    definition: "Insert hook, yarn over, pull through stitch and loop on hook in one motion.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  sc: {
    key: "sc",
    title: "Single Crochet (sc)",
    definition: "Insert hook, pull up loop, yarn over, pull through both loops.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  tr: {
    key: "tr",
    title: "Treble Crochet (tr)",
    definition: "Yarn over twice, insert hook, pull up loop, then yarn over and pull through 2 loops three times.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  rep: {
    key: "rep",
    title: "Repeat (rep)",
    definition: "Repeat the instruction sequence as stated.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  rnd: {
    key: "rnd",
    title: "Round (rnd)",
    definition: "A complete round of stitches (often worked in a spiral).",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  st: {
    key: "st",
    title: "Stitch (st)",
    definition: "A single stitch.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  sts: {
    key: "sts",
    title: "Stitches (sts)",
    definition: "Multiple stitches.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  inc: {
    key: "inc",
    title: "Increase (inc)",
    definition: "Work two stitches into the same stitch to increase stitch count.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  dec: {
    key: "dec",
    title: "Decrease (dec)",
    definition: "Work two stitches together to reduce stitch count.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  tog: {
    key: "tog",
    title: "Together (tog)",
    definition: "Work stitches together into one (used in decreases like hdc2tog).",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  round: {
    key: "round",
    title: "Round",
    definition: "Same as rnd — a complete round of stitches.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
  repeat: {
    key: "repeat",
    title: "Repeat",
    definition: "Same as rep — repeat the instruction sequence.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  },
};

/** ===== StepLine component ===== */
// Tokenizer: match "sl st" as one token first, then other words, then non-word chars
const TOKEN_RE = /sl\s*st|\w+|[^\w]/gi;

function StepLine({
  step,
  knownTerms,
  onTerm,
}: {
  step: Step;
  knownTerms: Set<string>;
  onTerm: (t: string) => void;
}) {
  const tokens = step.text.match(TOKEN_RE) ?? [];
  return (
    <Text style={styles.stepLine}>
      {tokens.map((token, i) => {
        const norm = normalizeTerm(token);
        if (norm && knownTerms.has(norm)) {
          return (
            <Text key={i} onPress={() => onTerm(norm)} style={styles.termInline}>
              {token}
            </Text>
          );
        }
        return <Text key={i}>{token}</Text>;
      })}
    </Text>
  );
}

/** ===== Screen ===== */
export default function HomeScreen() {
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [detectedTerms, setDetectedTerms] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<StitchInfo | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [backendStitches, setBackendStitches] = useState<Record<string, StitchInfo>>({});
  const [loading, setLoading] = useState(false);

  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["30%", "70%"], []);

  // Merge library keys + backend-detected terms into one set for fast lookup
  const knownTerms = useMemo(() => {
    const s = new Set<string>(Object.keys(STITCH_LIBRARY));
    detectedTerms.forEach((t) => s.add(t));
    return s;
  }, [detectedTerms]);

  const openHelp = useCallback((key: string) => {
    const norm = normalizeTerm(key);
    const item: StitchInfo =
      backendStitches[norm] ?? STITCH_LIBRARY[norm] ?? {
        key: norm,
        title: norm.toUpperCase(),
        definition: "Definition not available yet.",
        videoUrl: "",
      };
    setSelected(item);
    sheetRef.current?.snapToIndex(1);
  }, [backendStitches]);

  const pickPdf = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;

      setPdfUri(file.uri);
      setDetectedTerms([]);
      setSteps([]);
      setLoading(true);

      try {
        const form = new FormData();
        form.append("file", {
          uri: file.uri,
          name: file.name ?? "pattern.pdf",
          type: "application/pdf",
        } as any);
        const resp = await fetch("http://localhost:8000/parse-file", {
          method: "POST",
          body: form,
        });
        if (resp.ok) {
          const json = await resp.json();
          setDetectedTerms(json.unique_terms ?? []);
          setSteps(json.steps ?? []);
          const map: Record<string, StitchInfo> = {};
          for (const d of (json.stitch_details ?? [])) {
            map[d.term] = { key: d.term, title: d.title, definition: d.definition, videoUrl: d.tutorial_url };
          }
          setBackendStitches(map);
        }
      } catch (e) {
        console.log("Backend fetch failed (ignored):", e);
      } finally {
        setLoading(false);
      }
    } catch (e) {
      console.log("Pick PDF failed:", e);
    }
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Digital Crochet Mediator</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {pdfUri ? (
            <Pressable style={styles.btn} onPress={() => setShowPanel((v) => !v)}>
              <Text style={styles.btnText}>{showPanel ? "Hide" : "Show"}</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.btn} onPress={pickPdf}>
            <Text style={styles.btnText}>Pick PDF</Text>
          </Pressable>
        </View>
      </View>

      {!pdfUri ? (
        /* Empty state */
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pick a crochet pattern PDF to get started.</Text>
          <Text style={styles.emptySub}>
            Crochet terms in the pattern will be highlighted — tap any to see a tutorial video.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          {/* PDF viewer — top half */}
          <WebView
            source={{ uri: pdfUri }}
            style={styles.pdf}
            originWhitelist={["*"]}
            allowingReadAccessToURL={pdfUri}
          />

          {/* Steps / terms panel — bottom half */}
          {showPanel && (
            loading ? (
              <View style={styles.noSteps}>
                <ActivityIndicator color="#2ec4b6" size="small" />
                <Text style={[styles.noStepsText, { marginTop: 8 }]}>Analysing pattern…</Text>
              </View>
            ) : steps.length > 0 ? (
              <ScrollView style={styles.stepsScroll} contentContainerStyle={styles.stepsPadding}>
                <Text style={styles.panelTitle}>Pattern Steps — tap a highlighted term</Text>
                {steps.map((step, i) => (
                  <StepLine key={i} step={step} knownTerms={knownTerms} onTerm={openHelp} />
                ))}
              </ScrollView>
            ) : detectedTerms.length > 0 ? (
              <ScrollView style={styles.stepsScroll} contentContainerStyle={styles.stepsPadding}>
                <Text style={styles.panelTitle}>Detected Terms — tap any to see a tutorial</Text>
                <View style={styles.chipWrap}>
                  {detectedTerms.map((t) => (
                    <Pressable key={t} style={styles.chip} onPress={() => openHelp(t)}>
                      <Text style={styles.chipText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.noSteps}>
                <Text style={styles.noStepsText}>No crochet terms detected in this PDF.</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* Bottom sheet with definition + video */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {selected ? (
            <>
              <Text style={styles.sheetTitle}>{selected.title}</Text>
              <Text style={styles.sheetDef}>{selected.definition}</Text>
              {selected.videoUrl ? (
                <View style={styles.videoWrap}>
                  <WebView
                    source={{ uri: toEmbedUrl(selected.videoUrl) }}
                    style={styles.video}
                    javaScriptEnabled
                    allowsInlineMediaPlayback
                  />
                </View>
              ) : (
                <Text style={styles.noVideo}>No tutorial video available for this term yet.</Text>
              )}
            </>
          ) : (
            <Text style={styles.sheetDef}>Tap a stitch term to see help.</Text>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "white", fontSize: 16, fontWeight: "700" },
  btn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnText: { color: "white", fontWeight: "600" },

  empty: { flex: 1, justifyContent: "center", padding: 24 },
  emptyText: { color: "white", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySub: { color: "rgba(255,255,255,0.55)", lineHeight: 20 },

  body: { flex: 1 },
  pdf: { flex: 3 },

  stepsScroll: {
    flex: 2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0d1a2e",
  },
  stepsPadding: { padding: 14, paddingBottom: 40 },
  panelTitle: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "rgba(46,196,182,0.15)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipText: { color: "#2ec4b6", fontWeight: "700", fontSize: 13 },

  stepLine: { color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 22, marginBottom: 8 },
  termInline: {
    color: "#2ec4b6",
    fontWeight: "700",
    backgroundColor: "rgba(46,196,182,0.12)",
    borderRadius: 3,
  },

  noSteps: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  noStepsText: { color: "rgba(255,255,255,0.35)", fontSize: 13 },

  sheetBg: { backgroundColor: "#0d1a2e" },
  handle: { backgroundColor: "rgba(255,255,255,0.3)" },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sheetTitle: { color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  sheetDef: { color: "rgba(255,255,255,0.7)", lineHeight: 20, marginBottom: 14 },
  videoWrap: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  video: { width: "100%", height: 220 },
  noVideo: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
});
