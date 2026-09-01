import DeliveryAnimation from "@/components/deliveryAnimation";
import { router, Stack } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "404" }} />

      <View style={styles.container}>
        <View style={styles.animationContainer}>
          <DeliveryAnimation
            source={require("../assets/animations/404.json")}
            flip={false}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.errorCode}>404</Text>

          <Text style={styles.title}>Unmatched Route</Text>

          <Text style={styles.description}>
            Could not find the page you are looking for.
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.replace("/")}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#FFF8F2",
    flex: 1,
  },

  animationContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },

  content: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 50,
    paddingHorizontal: 30,
    paddingTop: 28,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    width: "100%",
    elevation: 4,
  },

  errorCode: {
    color: "#C23122",
    fontSize: 64,
    fontWeight: "800",
    marginBottom: 5,
  },

  title: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 25,
    fontWeight: "700",
    marginBottom: 10,
  },

  description: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: "center",
  },

  button: {
    backgroundColor: "#C23122",
    borderRadius: 14,
    marginTop: 28,
    paddingHorizontal: 35,
    paddingVertical: 14,
  },

  buttonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 15,
    fontWeight: "600",
  },
});
