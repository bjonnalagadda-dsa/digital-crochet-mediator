import { View, Text, Button, StyleSheet } from "react-native";
import { useState } from "react";

interface Props {
  totalSteps: number;
}

export default function StepTracker({ totalSteps }: Props) {
  const [current, setCurrent] = useState<number>(1);

  const nextStep = () => {
    if (current < totalSteps) {
      setCurrent(current + 1);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Current Step: {current}</Text>
      <Button title="Next Step" onPress={nextStep} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 4,
  },
});
