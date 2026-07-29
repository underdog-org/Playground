import { View, Text, StyleSheet } from "react-native";
import { color, space } from "@ims/design";

// Stage 0 的最小外殼。登入流程在 Stage 1 才進來。
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>IMS</Text>
      <Text style={styles.body}>OIDC Provider — Stage 0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.bgPage,
  },
  title: { color: color.textPrimary, fontSize: 24, fontWeight: "600" },
  body: { color: color.textPrimary },
});
