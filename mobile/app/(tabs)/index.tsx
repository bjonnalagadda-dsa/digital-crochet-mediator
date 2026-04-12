import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { WebView } from "react-native-webview";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { usePatternContext } from "../../hooks/PatternContext";
import { type StitchInfo, persistPdf } from "@/hooks/usePatternStorage";
import { useWizardControl } from "@/hooks/useWizardControl";
import { useTermMastery, type MasteryLevel } from "@/hooks/useTermMastery";

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

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Extract round number and stitch count from a step text line.
 *  e.g. "Round 3: sc, inc x6 (12)" → { round: 3, stitches: 12 }
 */
function parseStepCounters(text: string): { round: number | null; stitches: number | null } {
  const roundMatch = text.match(/(?:round|rnd|row)\s*(\d+)/i);
  const round = roundMatch ? parseInt(roundMatch[1], 10) : null;

  // Last parenthesised number is conventionally the stitch count for that round.
  // Use exec loop instead of matchAll to avoid Hermes iterator issues.
  let stitches: number | null = null;
  const parenRe = /\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(text)) !== null) {
    stitches = parseInt(m[1], 10);
  }

  return { round, stitches };
}

/** ===== Stitch Knowledge Base ===== */
const STITCH_LIBRARY: { [key: string]: StitchInfo } = {
  ch: { key: "ch", title: "Chain (ch)", definition: "Yarn over and pull through the loop on your hook.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  dc: { key: "dc", title: "Double Crochet (dc)", definition: "Yarn over, insert hook, pull up loop, yarn over pull through 2, yarn over pull through 2.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
  hdc: { key: "hdc", title: "Half Double Crochet (hdc)", definition: "Yarn over, insert hook, pull up loop, yarn over, pull through all 3 loops.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
  "sl st": { key: "sl st", title: "Slip Stitch (sl st)", definition: "Insert hook, yarn over, pull through stitch and loop on hook in one motion.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  sc: { key: "sc", title: "Single Crochet (sc)", definition: "Insert hook, pull up loop, yarn over, pull through both loops.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  tr: { key: "tr", title: "Treble Crochet (tr)", definition: "Yarn over twice, insert hook, pull up loop, then yarn over and pull through 2 loops three times.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  rep: { key: "rep", title: "Repeat (rep)", definition: "Repeat the instruction sequence as stated.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  rnd: { key: "rnd", title: "Round (rnd)", definition: "A complete round of stitches (often worked in a spiral).", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  st: { key: "st", title: "Stitch (st)", definition: "A single stitch.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  sts: { key: "sts", title: "Stitches (sts)", definition: "Multiple stitches.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  inc: { key: "inc", title: "Increase (inc)", definition: "Work two stitches into the same stitch to increase stitch count.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  dec: { key: "dec", title: "Decrease (dec)", definition: "Work two stitches together to reduce stitch count.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  tog: { key: "tog", title: "Together (tog)", definition: "Work stitches together into one (used in decreases like hdc2tog).", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  round: { key: "round", title: "Round", definition: "Same as rnd — a complete round of stitches.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  repeat: { key: "repeat", title: "Repeat", definition: "Same as rep — repeat the instruction sequence.", videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
};

/** ===== StepLine component ===== */
const TOKEN_RE = /sl\s*st|\w+|[^\w]/gi;

// Visual style per mastery level
const MASTERY_TERM: Record<string, object> = {
  new:      { color: "#2ec4b6", backgroundColor: "rgba(46,196,182,0.14)" },
  learning: { color: "#ffd166", backgroundColor: "rgba(255,209,102,0.10)" },
  mastered: { color: "rgba(6,214,160,0.45)", backgroundColor: "rgba(6,214,160,0.05)" },
};
const MASTERY_DOT: Record<string, string> = {
  new:      "#ff6b6b",
  learning: "#ffd166",
  mastered: "#06d6a0",
};

function StepLine({
  step, knownTerms, onTerm, isCurrent, index, onSelect, getMasteryLevel, masteryStore,
}: {
  step: { text: string; terms: string[] };
  knownTerms: Set<string>;
  onTerm: (t: string) => void;
  isCurrent: boolean;
  index: number;
  onSelect: (index: number) => void;
  getMasteryLevel: (term: string) => MasteryLevel;
  masteryStore: object; // passed only to trigger re-render when mastery changes
}) {
  const tokens = step.text.match(TOKEN_RE) ?? [];
  return (
    <Pressable onPress={() => onSelect(index)} style={[styles.stepRow, isCurrent && styles.stepRowCurrent]}>
      {isCurrent && <View style={styles.stepCurrentBar} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.stepNumber}>Step {index + 1}</Text>
        <Text style={[styles.stepLine, isCurrent && styles.stepLineCurrent]}>
          {tokens.map((token, i) => {
            const norm = normalizeTerm(token);
            if (norm && knownTerms.has(norm)) {
              const level = getMasteryLevel(norm);
              return (
                <Text key={i} onPress={() => onTerm(norm)} style={[styles.termInline, MASTERY_TERM[level]]}>
                  {token}
                  <Text style={{ color: MASTERY_DOT[level], fontSize: 7 }}>⬤</Text>
                </Text>
              );
            }
            return <Text key={i}>{token}</Text>;
          })}
        </Text>
      </View>
    </Pressable>
  );
}

/** ===== Screen ===== */
export default function HomeScreen() {
  const { activePattern, activeId, setActiveId, addPattern, updateProgress, updateParsedData, deletePattern, isLoaded } =
    usePatternContext();

  const [selected, setSelected] = useState<StitchInfo | null>(null);
  // 'pdf' = full-screen document view, 'steps' = full-screen pattern steps view
  const [activeView, setActiveView] = useState<"pdf" | "steps">("pdf");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [stitchCount, setStitchCount] = useState(0);
  const [roundCount, setRoundCount] = useState(0);

  const voiceCommandRef = useRef<(cmd: "next" | "previous") => void>(() => {});
  const { isConnected: wizConnected, error: wizError, toggle: toggleWiz } =
    useWizardControl({ onCommand: (cmd) => voiceCommandRef.current(cmd) });

  const { store: masteryStore, getMasteryLevel, recordTap, recordStepLeft } = useTermMastery();

  // Refs so navigation callbacks can read current values without stale closures
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const knownTermsRef = useRef(knownTerms);
  knownTermsRef.current = knownTerms;
  const tappedInStep = useRef<Set<string>>(new Set());

  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const stepsScrollRef = useRef<ScrollView>(null);
  const stepRowHeights = useRef<number[]>([]);
  const snapPoints = useMemo(() => ["35%", "75%"], []);

  const pdfUri = activePattern?.pdfUri ?? null;
  const steps = activePattern?.steps ?? [];
  const detectedTerms = activePattern?.detectedTerms ?? [];
  const backendStitches = activePattern?.backendStitches ?? {};
  const currentStepIndex = activePattern?.currentStepIndex ?? 0;

  const progressPct = steps.length > 0
    ? Math.round(((currentStepIndex + 1) / steps.length) * 100)
    : 0;

  const knownTerms = useMemo(() => {
    const s = new Set<string>(Object.keys(STITCH_LIBRARY));
    detectedTerms.forEach((t) => s.add(normalizeTerm(t)));
    return s;
  }, [detectedTerms]);

  // Scroll to current step when it changes
  useEffect(() => {
    if (steps.length === 0 || !stepsScrollRef.current) return;
    const offset = stepRowHeights.current.slice(0, currentStepIndex).reduce((sum, h) => sum + h, 0);
    stepsScrollRef.current.scrollTo({ y: Math.max(0, offset - 60), animated: true });
  }, [currentStepIndex, steps.length]);

  // Initialise counters when switching to a different pattern or when steps first load
  useEffect(() => {
    const s = steps ?? [];
    if (s.length === 0) { setRoundCount(0); setStitchCount(0); return; }
    const { round, stitches } = parseStepCounters(s[currentStepIndex]?.text ?? "");
    if (round !== null) setRoundCount(round);
    if (stitches !== null) setStitchCount(stitches);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Track mastery when the step changes — every navigation counts globally for all known terms
  const prevStepIndexRef = useRef(currentStepIndex);
  useEffect(() => {
    const prev = prevStepIndexRef.current;
    prevStepIndexRef.current = currentStepIndex;
    if (prev === currentStepIndex || !(stepsRef.current ?? []).length) return;
    // Pass all known terms: any step navigated without tapping a term counts toward its mastery
    const allTerms: string[] = [];
    knownTermsRef.current.forEach((t) => allTerms.push(t));
    recordStepLeft(allTerms, tappedInStep.current);
    tappedInStep.current = new Set();
  }, [currentStepIndex, recordStepLeft]);

  const openHelp = useCallback((key: string) => {
    const norm = normalizeTerm(key);
    const item: StitchInfo =
      backendStitches[norm] ?? STITCH_LIBRARY[norm] ?? {
        key: norm, title: norm.toUpperCase(), definition: "Definition not available yet.", videoUrl: "",
      };
    recordTap(norm);
    tappedInStep.current.add(norm);
    setSelected(item);
    sheetRef.current?.snapToIndex(1);
  }, [backendStitches, recordTap]);

  const uploadPdf = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;

      const id = newId();
      const permanentUri = persistPdf(file.uri, id);

      addPattern({
        id,
        name: file.name ?? "pattern.pdf",
        addedAt: Date.now(),
        pdfUri: permanentUri,
        currentStepIndex: 0,
        detectedTerms: [],
        steps: [],
        backendStitches: {},
      });

      setActiveView("pdf");
      setAnalysing(true);

      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        console.log("[Backend] API_URL =", apiUrl);
        const form = new FormData();
        form.append("file", { uri: permanentUri, name: file.name ?? "pattern.pdf", type: "application/pdf" } as any);
        const resp = await fetch(`${apiUrl}/parse-file`, { method: "POST", body: form });
        if (resp.ok) {
          const json = await resp.json();
          const map: Record<string, StitchInfo> = {};
          for (const d of json.stitch_details ?? []) {
            map[d.term] = { key: d.term, title: d.title, definition: d.definition, videoUrl: d.tutorial_url };
          }
          updateParsedData(id, {
            detectedTerms: json.unique_terms ?? [],
            steps: json.steps ?? [],
            backendStitches: map,
          });
        }
      } catch (e) {
        console.log("Backend fetch failed (ignored):", e);
      } finally {
        setAnalysing(false);
      }
    } catch (e) {
      console.log("Upload PDF failed:", e);
    }
  }, [addPattern, updateParsedData]);

  const syncCounters = useCallback((index: number, direction: "next" | "prev") => {
    const s = steps ?? [];
    const text = s[index]?.text ?? "";
    const { round, stitches } = parseStepCounters(text);
    if (round !== null) setRoundCount(round);
    if (direction === "next") {
      setStitchCount(0);
    } else if (stitches !== null) {
      setStitchCount(stitches);
    }
  }, [steps]);

  const handleStepSelect = useCallback((index: number) => {
    if (!activeId) return;
    const direction = index > currentStepIndex ? "next" : "prev";
    updateProgress(activeId, index);
    syncCounters(index, direction);
  }, [activeId, currentStepIndex, updateProgress, syncCounters]);

  const goToPrevStep = useCallback(() => {
    if (!activeId) return;
    const next = Math.max(0, currentStepIndex - 1);
    updateProgress(activeId, next);
    syncCounters(next, "prev");
  }, [activeId, currentStepIndex, updateProgress, syncCounters]);

  const goToNextStep = useCallback(() => {
    if (!activeId) return;
    const len = (steps ?? []).length;
    const next = Math.min(len - 1, currentStepIndex + 1);
    updateProgress(activeId, next);
    syncCounters(next, "next");
  }, [activeId, currentStepIndex, steps, updateProgress, syncCounters]);

  const handleClear = useCallback(() => {
    setActiveId(null);
    setActiveView("pdf");
  }, [setActiveId]);

  // Wire voice commands to step navigation after callbacks are defined
  voiceCommandRef.current = (cmd) => {
    if (cmd === "next") goToNextStep();
    else goToPrevStep();
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#2ec4b6" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Digital Crochet Mediator</Text>
        <View style={styles.headerActions}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={uploadPdf}>
            <Text style={[styles.btnText, { color: "#0b1220" }]}>Upload PDF</Text>
          </Pressable>
          {pdfUri && (
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={handleClear}>
              <Text style={styles.btnText}>Close</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!pdfUri ? (
        /* ── Empty state ── */
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No pattern loaded</Text>
          <Text style={styles.emptyBody}>
            Tap <Text style={styles.emptyHighlight}>Upload PDF</Text> to add a crochet pattern from your device.
            Crochet terms in the pattern will be highlighted — tap any to see a definition and tutorial video.
          </Text>
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              Previously uploaded patterns are saved in the{" "}
              <Text style={styles.emptyHighlight}>Library</Text> tab below.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          {/* ── View toggle ── */}
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.toggleBtn, activeView === "pdf" && styles.toggleBtnActive]}
              onPress={() => setActiveView("pdf")}
            >
              <Text style={[styles.toggleBtnText, activeView === "pdf" && styles.toggleBtnTextActive]}>
                PDF Document
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, activeView === "steps" && styles.toggleBtnActive]}
              onPress={() => setActiveView("steps")}
            >
              <Text style={[styles.toggleBtnText, activeView === "steps" && styles.toggleBtnTextActive]}>
                Pattern Steps
              </Text>
              {analysing && (
                <ActivityIndicator size={10} color="#2ec4b6" style={{ marginLeft: 6 }} />
              )}
              {!analysing && steps.length > 0 && (
                <View style={styles.toggleBadge}>
                  <Text style={styles.toggleBadgeText}>{steps.length}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* ── PDF view (full screen) ── */}
          {activeView === "pdf" && (
            <View style={styles.fullView}>
              <WebView
                source={{ uri: pdfUri }}
                style={StyleSheet.absoluteFill}
                originWhitelist={["*"]}
                allowingReadAccessToURL={pdfUri}
                onLoadStart={() => setPdfLoading(true)}
                onLoadEnd={() => setPdfLoading(false)}
              />
              {pdfLoading && (
                <View style={styles.pdfLoadingOverlay}>
                  <ActivityIndicator color="#2ec4b6" size="large" />
                  <Text style={styles.pdfLoadingText}>Loading document…</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Steps view (full screen) ── */}
          {activeView === "steps" && (
            <View style={styles.fullView}>
              {analysing ? (
                <View style={styles.centered}>
                  <ActivityIndicator color="#2ec4b6" size="large" />
                  <Text style={styles.analysingText}>Analysing your pattern…</Text>
                  <Text style={styles.analysingSubText}>
                    We're breaking the document into step-by-step instructions.
                  </Text>
                </View>
              ) : steps.length > 0 ? (
                <>
                  {/* Progress header */}
                  <View style={styles.progressHeader}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>
                        Step {currentStepIndex + 1} of {steps.length}
                      </Text>
                      <Text style={styles.progressPct}>{progressPct}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
                    </View>
                    <Text style={styles.stepsHint}>
                      Tap any <Text style={styles.termInlineStatic}>highlighted term</Text> for its definition and tutorial.
                    </Text>
                  </View>

                  {/* Steps list */}
                  <ScrollView
                    ref={stepsScrollRef}
                    style={styles.stepsScroll}
                    contentContainerStyle={styles.stepsPadding}
                    showsVerticalScrollIndicator
                    indicatorStyle="white"
                  >
                    {steps.map((step, i) => (
                      <View
                        key={i}
                        onLayout={(e) => { stepRowHeights.current[i] = e.nativeEvent.layout.height; }}
                      >
                        <StepLine
                          step={step}
                          knownTerms={knownTerms}
                          onTerm={openHelp}
                          isCurrent={i === currentStepIndex}
                          index={i}
                          onSelect={handleStepSelect}
                          getMasteryLevel={getMasteryLevel}
                          masteryStore={masteryStore}
                        />
                      </View>
                    ))}
                  </ScrollView>

                  {/* Stitch + Round counters */}
                  <View style={styles.countersRow}>
                    {/* Round counter (left) */}
                    <View style={styles.counterCard}>
                      <Text style={styles.counterLabel}>Round / Row</Text>
                      <View style={styles.counterControls}>
                        <Pressable style={styles.counterBtn} onPress={() => setRoundCount(Math.max(0, roundCount - 1))}>
                          <Text style={styles.counterBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.counterValue}>{roundCount}</Text>
                        <Pressable style={styles.counterBtn} onPress={() => setRoundCount(roundCount + 1)}>
                          <Text style={styles.counterBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.counterDivider} />

                    {/* Stitch counter (right) */}
                    <View style={styles.counterCard}>
                      <Text style={styles.counterLabel}>Stitches</Text>
                      <View style={styles.counterControls}>
                        <Pressable style={styles.counterBtn} onPress={() => setStitchCount(Math.max(0, stitchCount - 1))}>
                          <Text style={styles.counterBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.counterValue}>{stitchCount}</Text>
                        <Pressable style={styles.counterBtn} onPress={() => setStitchCount(stitchCount + 1)}>
                          <Text style={styles.counterBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Navigation buttons + mic — fixed at bottom */}
                  <View style={styles.navBar}>
                    <Pressable
                      style={[styles.navBtn, currentStepIndex === 0 && styles.navBtnDisabled]}
                      onPress={goToPrevStep}
                      disabled={currentStepIndex === 0}
                    >
                      <Text style={styles.navBtnText}>← Prev</Text>
                    </Pressable>

                    {/* Mic button (WoZ — appears as voice control to participant) */}
                    <Pressable
                      style={[styles.micBtn, wizConnected && styles.micBtnActive]}
                      onPress={toggleWiz}
                    >
                      <Ionicons
                        name={wizConnected ? "mic" : "mic-outline"}
                        size={22}
                        color={wizConnected ? "#0b1220" : TEAL}
                      />
                      {wizConnected && (
                        <ActivityIndicator
                          size={8}
                          color="#0b1220"
                          style={{ position: "absolute", bottom: 4, right: 4 }}
                        />
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.navBtn, styles.navBtnNext, currentStepIndex === (steps ?? []).length - 1 && styles.navBtnDisabled]}
                      onPress={goToNextStep}
                      disabled={currentStepIndex === (steps ?? []).length - 1}
                    >
                      <Text style={[styles.navBtnText, { color: "#0b1220" }]}>Next →</Text>
                    </Pressable>
                  </View>
                  {/* Voice feedback strip (WoZ illusion) */}
                  <View style={styles.voiceStrip}>
                    {wizConnected
                      ? <Text style={styles.voiceStatusText}>🎙 Listening… say "next" or "back"</Text>
                      : wizError
                        ? <Text style={styles.voiceErrorText}>Microphone unavailable — tap mic to retry</Text>
                        : <Text style={styles.voiceStatusText}>Tap the mic to enable voice navigation</Text>
                    }
                  </View>
                </>
              ) : detectedTerms.length > 0 ? (
                <ScrollView contentContainerStyle={styles.stepsPadding}>
                  <Text style={styles.sectionLabel}>Detected Terms</Text>
                  <Text style={styles.stepsHint}>
                    No step-by-step breakdown was found for this pattern, but these crochet terms were detected.
                    Tap any to see its definition and tutorial video.
                  </Text>
                  <View style={styles.chipWrap}>
                    {detectedTerms.map((t) => (
                      <Pressable key={t} style={styles.chip} onPress={() => openHelp(t)}>
                        <Text style={styles.chipText}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.centered}>
                  <Text style={styles.noStepsTitle}>No steps detected</Text>
                  <Text style={styles.noStepsBody}>
                    The backend didn't find structured steps in this pattern. Try viewing the PDF directly.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}


      {/* ── Bottom sheet: stitch definition + video ── */}
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
            <Text style={styles.sheetDef}>Tap a highlighted stitch term to see its definition and tutorial.</Text>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const TEAL = "#2ec4b6";
const BG = "#0b1220";
const CARD = "#0d1a2e";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "white", fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },
  headerActions: { flexDirection: "row", gap: 8 },
  btn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnPrimary: { backgroundColor: TEAL },
  btnSecondary: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnText: { color: "white", fontWeight: "700", fontSize: 13 },

  // Empty state
  empty: { flex: 1, justifyContent: "center", padding: 28 },
  emptyTitle: { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  emptyBody: { color: "rgba(255,255,255,0.55)", fontSize: 15, lineHeight: 22, marginBottom: 20 },
  emptyHighlight: { color: TEAL, fontWeight: "700" },
  emptyHint: {
    backgroundColor: "rgba(46,196,182,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.2)",
    borderRadius: 10,
    padding: 14,
  },
  emptyHintText: { color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 19 },

  body: { flex: 1 },

  // View toggle tabs
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    margin: 12,
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  toggleBtnActive: { backgroundColor: CARD, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  toggleBtnText: { color: "rgba(255,255,255,0.4)", fontWeight: "600", fontSize: 13 },
  toggleBtnTextActive: { color: "white" },
  toggleBadge: {
    backgroundColor: TEAL,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  toggleBadgeText: { color: "#0b1220", fontSize: 10, fontWeight: "800" },

  // Full-screen views
  fullView: { flex: 1, overflow: "hidden" },

  // PDF loading overlay
  pdfLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pdfLoadingText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },

  // Steps view: progress header
  progressHeader: {
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  progressLabel: { color: "white", fontWeight: "700", fontSize: 14 },
  progressPct: { color: TEAL, fontWeight: "800", fontSize: 14 },
  progressTrack: { height: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", backgroundColor: TEAL, borderRadius: 3 },
  stepsHint: { color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 17 },
  termInlineStatic: { color: TEAL, fontWeight: "700" },

  // Steps list
  stepsScroll: { flex: 1, backgroundColor: BG },
  stepsPadding: { padding: 14, paddingBottom: 16 },
  sectionLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  // Step rows
  stepRow: {
    flexDirection: "row",
    borderRadius: 8,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  stepRowCurrent: {
    backgroundColor: "rgba(46,196,182,0.08)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.3)",
  },
  stepCurrentBar: { width: 3, borderRadius: 2, backgroundColor: TEAL, marginRight: 10, alignSelf: "stretch" },
  stepNumber: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  stepLine: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 22 },
  stepLineCurrent: { color: "white" },
  termInline: {
    color: TEAL,
    fontWeight: "700",
    backgroundColor: "rgba(46,196,182,0.12)",
    borderRadius: 3,
  },

  // Counters strip
  countersRow: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  counterCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  counterDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 8,
  },
  counterLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(46,196,182,0.12)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnText: {
    color: TEAL,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  counterValue: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    minWidth: 36,
    textAlign: "center",
  },

  // Navigation bar
  navBar: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  navBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(46,196,182,0.12)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.25)",
  },
  navBtnNext: { backgroundColor: TEAL, borderColor: TEAL },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: TEAL, fontWeight: "700", fontSize: 15 },

  // Chips (terms-only mode)
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: "rgba(46,196,182,0.12)",
    borderWidth: 1,
    borderColor: "rgba(46,196,182,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipText: { color: TEAL, fontWeight: "700", fontSize: 13 },

  // WoZ / mic button (sits in the nav bar between Prev / Next)
  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(46,196,182,0.5)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,196,182,0.1)",
  },
  micBtnActive: { backgroundColor: TEAL, borderColor: TEAL },

  // Voice feedback strip below nav bar
  voiceStrip: {
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  voiceStatusText: { color: TEAL, fontSize: 13, fontWeight: "600" },
  voiceErrorText: { color: "rgba(255,160,80,0.9)", fontSize: 12 },

  // No-steps state
  noStepsTitle: { color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  noStepsBody: { color: "rgba(255,255,255,0.3)", fontSize: 13, lineHeight: 19, textAlign: "center" },

  // Analysing state
  analysingText: { color: "white", fontSize: 16, fontWeight: "700", marginTop: 16, textAlign: "center" },
  analysingSubText: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 19 },

  // Bottom sheet
  sheetBg: { backgroundColor: CARD },
  handle: { backgroundColor: "rgba(255,255,255,0.3)" },
  sheetContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sheetTitle: { color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  sheetDef: { color: "rgba(255,255,255,0.65)", lineHeight: 20, marginBottom: 14 },
  videoWrap: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  video: { width: "100%", height: 220 },
  noVideo: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
});
