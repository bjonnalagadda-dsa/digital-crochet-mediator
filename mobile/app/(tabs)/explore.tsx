import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePatternContext } from "../../hooks/PatternContext";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
    </View>
  );
}

export default function LibraryScreen() {
  const { library, activeId, setActiveId, deletePattern } = usePatternContext();
  const insets = useSafeAreaInsets();

  const handleContinue = useCallback(
    (id: string) => {
      setActiveId(id);
      router.navigate("/(tabs)/");
    },
    [setActiveId]
  );

  return (
    <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>
          {library.length === 0
            ? "No patterns yet"
            : `${library.length} pattern${library.length === 1 ? "" : "s"}`}
        </Text>
      </View>

      {library.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmarks-outline" size={52} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyTitle}>No saved patterns yet</Text>
          <Text style={styles.emptySub}>
            Upload a crochet pattern PDF from the Pattern tab and it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {library.map((pattern) => {
            const isActive = pattern.id === activeId;
            const hasSteps = pattern.steps.length > 0;

            return (
              <Pressable
                key={pattern.id}
                style={[styles.card, isActive && styles.cardActive]}
                onPress={() => handleContinue(pattern.id)}
              >
                {/* Active indicator */}
                {isActive && <View style={styles.activeBar} />}

                <View style={styles.cardBody}>
                  {/* Top row: name + delete */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={isActive ? "#2ec4b6" : "rgba(255,255,255,0.5)"}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.cardName, isActive && styles.cardNameActive]} numberOfLines={1}>
                        {pattern.name}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        deletePattern(pattern.id);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color="rgba(255,80,80,0.7)" />
                    </Pressable>
                  </View>

                  {/* Date + step count */}
                  <Text style={styles.cardMeta}>
                    Added {formatDate(pattern.addedAt)}
                    {hasSteps
                      ? `  ·  Step ${pattern.currentStepIndex + 1} of ${pattern.steps.length}`
                      : pattern.detectedTerms.length > 0
                      ? `  ·  ${pattern.detectedTerms.length} terms`
                      : "  ·  Not yet analysed"}
                  </Text>

                  {/* Progress bar (only when steps exist) */}
                  {hasSteps && (
                    <ProgressBar
                      current={pattern.currentStepIndex}
                      total={pattern.steps.length}
                    />
                  )}

                  {/* Continue label */}
                  <View style={styles.continueRow}>
                    <Text style={[styles.continueLabel, isActive && styles.continueLabelActive]}>
                      {isActive ? "Currently open" : "Tap to continue"}
                    </Text>
                    {!isActive && (
                      <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.3)" />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: { color: "white", fontSize: 22, fontWeight: "800", marginBottom: 2 },
  subtitle: { color: "rgba(255,255,255,0.4)", fontSize: 13 },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: { color: "rgba(255,255,255,0.55)", fontSize: 16, fontWeight: "700" },
  emptySub: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#0d1a2e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "rgba(46,196,182,0.35)",
    backgroundColor: "#0e1f32",
  },

  activeBar: {
    width: 3,
    backgroundColor: "#2ec4b6",
  },

  cardBody: { flex: 1, padding: 14 },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  cardName: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  cardNameActive: { color: "white" },

  deleteBtn: {
    padding: 4,
  },

  cardMeta: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginBottom: 8,
  },

  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2ec4b6",
    borderRadius: 2,
  },

  continueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  continueLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  continueLabelActive: { color: "#2ec4b6" },
});
