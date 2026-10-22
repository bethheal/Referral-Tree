import DeliveryAnimation from "@/components/deliveryAnimation";
import NavigationButtons from "@/components/navigationBtn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

const onboardingData = [
  {
    id: "onboarding1",
    title: "Angel Foods",
    description: "Discover quality food products, all in one place.",
    animation: require("../assets/animations/welcome.json"),
    flip: true,
  },

  {
    id: "onboarding2",
    title: "Buy healthy, buy happy",
    description: "Shop your favorite quality food products with ease.",
    animation: require("../assets/animations/order.json"),
    flip: false,
  },

  {
    id: "onboarding3",
    title: "Delivery to your doorstep",
    description:
      "We ensure that you get the best quality food products delivered to your doorstep.",
    animation: require("../assets/animations/deliveryYello.json"),
    flip: false,
  },

  {
    id: "onboarding4",
    title: "Earn rewards",
    description: "Earn rewards by referring others to Angel Foods.",
    animation: require("../assets/animations/reward1.json"),
    flip: false,
  },
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  // --------------------------------
  // NEXT SLIDE
  // --------------------------------

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;

      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });

      setCurrentIndex(nextIndex);
    }
  };

  // --------------------------------
  // PREVIOUS SLIDE
  // --------------------------------

  const handleBack = () => {
    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;

      flatListRef.current?.scrollToIndex({
        index: previousIndex,
        animated: true,
      });

      setCurrentIndex(previousIndex);
    }
  };

  // --------------------------------
  // CLICK DOT
  // --------------------------------

  const handleDotPress = (index: number) => {
    flatListRef.current?.scrollToIndex({
      index,
      animated: true,
    });

    setCurrentIndex(index);
  };

  // --------------------------------
  // UPDATE CURRENT SLIDE
  // --------------------------------

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;

    const index = Math.round(offsetX / width);

    if (index >= 0 && index < onboardingData.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  // --------------------------------
  // START SHOPPING
  // --------------------------------

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem("onboardingComplete", "true");
    } catch (error) {
      console.log("Saving onboarding status failed:", error);
    } finally {
      router.replace("/auth/login");
    }
  };

  const handleStartShopping = () => {
    finishOnboarding();
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  return (
    <View style={styles.container}>
      {/* STATUS BAR */}
      <StatusBar barStyle="dark-content" backgroundColor="#f0e3e3" />

      {/* CAROUSEL */}

      <FlatList
        ref={flatListRef}
        data={onboardingData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* LOGO */}

            <Image
              source={require("../assets/images/logo.png")}
              style={styles.logo}
            />

            {/* ANIMATION */}

            <View style={styles.animationContainer}>
              <DeliveryAnimation source={item.animation} flip={item.flip} />
            </View>

            {/* TITLE */}

            <Text style={styles.title}>{item.title}</Text>

            {/* DESCRIPTION */}

            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      {/* CLICKABLE DOTS */}

      <View style={styles.dotsContainer}>
        {onboardingData.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleDotPress(index)}
            activeOpacity={0.7}
            style={[styles.dot, currentIndex === index && styles.activeDot]}
          />
        ))}
      </View>

      {/* NAVIGATION */}

      <View style={styles.bottomContainer}>
        {/* LAST SLIDE */}

        {currentIndex === onboardingData.length - 1 ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleStartShopping}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Start Shopping</Text>
          </TouchableOpacity>
        ) : (
          <NavigationButtons
            onNext={handleNext}
            onBack={handleBack}
            showBack={currentIndex > 0}
            showSkip={true}
            showNext={true}
            skipRoute="/auth/login"
            onSkip={handleSkip}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0e3e3",
  },

  slide: {
    width: width,

    alignItems: "center",

    paddingHorizontal: 20,
  },

  animationContainer: {
    width: width - 40,

    height: 420,

    marginTop: 100,

    borderRadius: 30,

    overflow: "hidden",

    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontFamily: "PoppinsBold",

    fontSize: 30,

    marginTop: 20,

    textAlign: "center",

    textTransform: "uppercase",

    color: "#192536",
  },

  description: {
    fontFamily: "RobotoSlabRegular",

    fontSize: 18,

    textAlign: "center",

    color: "#5b5a5a",

    marginTop: 15,

    lineHeight: 25,

    paddingHorizontal: 20,
  },

  /* -------------------------
     DOTS
  ------------------------- */

  dotsContainer: {
    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    marginBottom: 25,
  },

  dot: {
    width: 10,

    height: 10,

    borderRadius: 5,

    backgroundColor: "#ccc",

    marginHorizontal: 5,

    padding: 5,
  },

  activeDot: {
    width: 25,

    backgroundColor: "#D7B126",
  },

  /* -------------------------
     BOTTOM
  ------------------------- */

  bottomContainer: {
    alignItems: "center",

    paddingBottom: 30,

    width: "100%",
  },

  /* -------------------------
     START SHOPPING
  ------------------------- */

  button: {
    backgroundColor: "#192536",

    paddingVertical: 15,

    paddingHorizontal: 40,

    borderRadius: 10,
  },

  buttonText: {
    color: "#fff",

    fontSize: 18,

    fontWeight: "bold",
  },

  /* -------------------------
     LOGO
  ------------------------- */

  logo: {
    width: 40,

    height: 40,

    resizeMode: "contain",

    position: "absolute",

    top: (StatusBar.currentHeight ?? 0) + 20,

    left: 20,

    zIndex: 10,
  },
});
