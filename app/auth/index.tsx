import { router } from "expo-router";
import {
  Image,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
};

export default function Auth() {
  const greeting = getGreeting();

  return (
    <ImageBackground
      source={require("../../assets/images/onboard.png")}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />
          <Text style={styles.brand}>ANGEL FOODS</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.title}>{greeting}</Text>
          <Text style={styles.description}>
            Sign in or create an account with only the essentials.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.86}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.primaryButtonText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.86}
            onPress={() => router.push("/auth/signup")}
          >
            <Text style={styles.secondaryButtonText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#fff8f2",
  },

  backgroundImage: {
    opacity: 0.2,
    resizeMode: "cover",
  },

  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: (StatusBar.currentHeight ?? 0) + 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },

  logo: {
    width: 42,
    height: 42,
    resizeMode: "contain",
  },

  brand: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#2F170F",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },

  title: {
    color: "#261D1A",
    fontFamily: "PoppinsBold",
    fontSize: 34,
    lineHeight: 40,
  },

  description: {
    color: "#6C625F",
    fontFamily: "RobotoSlabRegular",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 26,
    marginTop: 10,
  },

  primaryButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 16,
    paddingVertical: 16,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  secondaryButton: {
    alignItems: "center",
    borderColor: "#E4D5D1",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 16,
  },

  secondaryButtonText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },
});
