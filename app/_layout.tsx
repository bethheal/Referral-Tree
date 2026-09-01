
import {
  Merriweather_400Regular,
  Merriweather_700Bold,
} from "@expo-google-fonts/merriweather";

import {
  Poppins_400Regular,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import {
  RobotoSlab_400Regular,
  RobotoSlab_700Bold,
} from "@expo-google-fonts/roboto-slab";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PoppinsRegular: Poppins_400Regular,
    PoppinsBold: Poppins_700Bold,

    RobotoSlabRegular: RobotoSlab_400Regular,
    RobotoSlabBold: RobotoSlab_700Bold,

    MerriweatherRegular: Merriweather_400Regular,
    MerriweatherBold: Merriweather_700Bold,
  });

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const loggedIn = await AsyncStorage.getItem("loggedIn");

        console.log("Logged in:", loggedIn);
      } catch (error) {
        console.log("Login check failed:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    if (fontsLoaded) {
      checkLogin();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || isCheckingAuth) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

