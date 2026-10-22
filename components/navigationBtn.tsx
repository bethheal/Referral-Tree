import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type NavigationButtonsProps = {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;

  showBack?: boolean;
  showSkip?: boolean;
  showNext?: boolean;

  skipRoute?: string;
};

export default function NavigationButtons({
  onNext,
  onBack,
  onSkip,
  showBack = false,
  showSkip = false,
  showNext = false,
  skipRoute = "/auth/login",
}: NavigationButtonsProps) {

  // SKIP ONBOARDING
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      return;
    }

    router.replace(skipRoute as any);
  };

  return (
    <View style={styles.container}>

      {/* BACK BUTTON */}
      {showBack ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <FontAwesome6
            name="arrow-left"
            size={18}
            color="#192536"
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      {/* SKIP BUTTON */}
      {showSkip ? (
        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>
            Skip
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.skipPlaceholder} />
      )}

      {/* NEXT BUTTON */}
      {showNext ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <FontAwesome6
            name="arrow-right"
            size={18}
            color="#192536"
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 25,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconButton: {
    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",

    elevation: 3,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  skipButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  skipText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  placeholder: {
    width: 48,
    height: 48,
  },

  skipPlaceholder: {
    width: 50,
  },
});
