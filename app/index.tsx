

import Loading from "@/components/loading";
import { hasAuthSession } from "@/components/backendApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const routeUser = async () => {
        try {
          const [loggedIn, onboardingComplete] = await Promise.all([
            hasAuthSession(),
            AsyncStorage.getItem("onboardingComplete"),
          ]);

          if (loggedIn) {
            router.replace("/dashboard");
            return;
          }

          router.replace(
            onboardingComplete === "true" ? "/auth/login" : "/onboarding"
          );
        } catch (error) {
          console.log("Startup route check failed:", error);
          router.replace("/onboarding");
        }
      };

      routeUser();
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/logo.png")} style={styles.img} />

      <Text style={styles.text}>ANGEL FOODS</Text>
      <Loading />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffefe",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "PoppinsBold",
    color: "#192536",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  img: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
});
