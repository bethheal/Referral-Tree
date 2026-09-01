// components/Loading.tsx

import LottieView from "lottie-react-native";
import { View, StyleSheet } from "react-native";

export default function Loading() {
  return (
    <View>
      <LottieView
        source={require("../assets/animations/loading.json")}
        autoPlay
        loop
        style={styles.animation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
 
  animation: {
    width: 180,
    height: 180,
  },
});