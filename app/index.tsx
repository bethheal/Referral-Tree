

import Loading from "@/components/loading";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/onboarding");
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
    color: "#C23122",
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
