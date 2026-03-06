import { View, Text, StyleSheet } from "react-native";
import { patternStep } from "../types/pattern";

interface Props {
  stepData: patternStep;
}

export default function PatternStep({ stepData }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.stepNumber}>Step {stepData.step}</Text>
      <Text style={styles.stepText}>{stepData.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  stepNumber: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  stepText: {
    fontSize: 16,
  },
});
