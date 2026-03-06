import { Modal, View, Text, Button } from "react-native";
import { Stitch } from "../types/stitch";

interface Props {
  visible: boolean;
  stitch?: Stitch;
  onClose: () => void;
}

export default function StitchModal({ visible, stitch, onClose }: Props) {
  if (!stitch) return null;

  return (
    <Modal visible={visible}>
      <View>
        <Text>{stitch.name}</Text>
        <Text>{stitch.instructions}</Text>
        <Button title="Close" onPress={onClose} />
      </View>
    </Modal>
  );
}
