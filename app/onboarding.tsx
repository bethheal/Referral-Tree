import DeliveryAnimation from "@/components/deliveryAnimation";
import NavigationButtons from "@/components/navigationBtn";
import { MOBILE_CONTENT_GUTTER } from "@/components/layout";
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
    title: "Welcome to Angelic mkts",
    description:
      "Discover quality food packages and a supportive community, all in one place.",
    animation: require("../assets/animations/welcome.json"),
    flip: true,
  },

  {
    id: "onboarding2",
    title: "Choose your membership path",
    description:
      "Start with a seven-day free membership, then explore the plan that suits your goals.",
    animation: require("../assets/animations/order.json"),
    flip: false,
  },

  {
    id: "onboarding3",
    title: "Marketing made simple",
    description:
      "Browse Angelic mkts packages and manage your orders from one convenient place.",
    animation: require("../assets/animations/deliveryYello.json"),
    flip: false,
  },

  {
    id: "onboarding4",
    title: "Grow with your community",
    description:
      "Invite people you know and keep track of your Angelic mkts membership journey.",
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
  // MEMBER ENTRY
  // --------------------------------

  const finishOnboarding = async (route: "/auth/login" | "/auth/signup") => {
    try {
      await AsyncStorage.setItem("onboardingComplete", "true");
    } catch (error) {
      console.log("Saving onboarding status failed:", error);
    } finally {
      router.push(route);
    }
  };

  const handleExistingMember = () => {
    finishOnboarding("/auth/login");
  };

  const handleNewMember = () => {
    finishOnboarding("/auth/signup");
  };

  const handleSkip = () => {
    finishOnboarding("/auth/login");
  };

  return (
    <View style={styles.container}>
      {/* STATUS BAR */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
          <View style={styles.memberButtons}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleExistingMember}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Existing member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newMemberButton}
              onPress={handleNewMember}
              activeOpacity={0.8}
            >
              <Text style={styles.newMemberButtonText}>New member</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: "#FFFFFF",
  },

  slide: {
    width: width,

    alignItems: "center",

    paddingHorizontal: MOBILE_CONTENT_GUTTER,
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

    paddingHorizontal: MOBILE_CONTENT_GUTTER,
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
     MEMBER ENTRY
  ------------------------- */

  memberButtons: {
    gap: 12,
    paddingHorizontal: MOBILE_CONTENT_GUTTER,
    width: "100%",
  },

  button: {
    alignItems: "center",
    backgroundColor: "#192536",
    paddingVertical: 15,
    borderRadius: 10,
  },

  newMemberButton: {
    alignItems: "center",
    borderColor: "#192536",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
  },

  buttonText: {
    color: "#fff",

    fontSize: 18,

    fontWeight: "bold",
  },

  newMemberButtonText: {
    color: "#192536",
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
