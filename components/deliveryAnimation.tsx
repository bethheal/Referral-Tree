import LottieView from "lottie-react-native";
import { StyleSheet, View } from "react-native";

type AnimationProps = {
  source: any;
  flip?: boolean;
};

export default function DeliveryAnimation({
  source,
  flip = false,
}: AnimationProps) {
  return (
    <View style={styles.container}>
      <LottieView
        source={source}
        autoPlay
        loop
        style={[
          styles.animation,
          flip && { transform: [{ scaleX: -1 }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  animation: {
    width: 300,
    height: 300,

  },
});