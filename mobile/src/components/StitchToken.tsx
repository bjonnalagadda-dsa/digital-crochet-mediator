import { Text, TouchableOpacity } from "react-native";

interface Props {
  stitch: string;
  onPress: (stitch: string) => void;
}

export default function StitchToken({ stitch, onPress }: Props) {
  return (
    <TouchableOpacity onPress={() => onPress(stitch)}>
      <Text style={{ color: "blue", fontWeight: "bold" }}>{stitch}</Text>
    </TouchableOpacity>
  );
}
