import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
} from "react-native";
import type { PressableProps, TextProps, ViewProps } from "react-native";

/*
 * Built on React Native's own Animated API, so there are no extra packages.
 * Everything respects the system "Reduce Motion" accessibility setting.
 */

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    reduceMotion = enabled;
  })
  .catch(() => undefined);

AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
  reduceMotion = enabled;
});

/** Call right before a state change that shows, hides or reorders content. */
export function animateLayout() {
  if (!reduceMotion) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }
}

/* -------------------------------------------------------------------------- */
/* Entrance                                                                   */
/* -------------------------------------------------------------------------- */

function useEntrance(delay: number | undefined, distance: number, axis: "x" | "y" = "y") {
  const skip = delay === undefined || reduceMotion;
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;

  useEffect(() => {
    if (skip) return;

    Animated.timing(progress, {
      delay,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return {
    opacity: progress,
    transform: [axis === "x" ? { translateX: offset } : { translateY: offset }],
  };
}

type FadeInViewProps = ViewProps & {
  axis?: "x" | "y";
  delay?: number;
  distance?: number;
};

/** Fades and slides its content in when it mounts. */
export function FadeInView({
  axis = "y",
  delay = 0,
  distance = 14,
  style,
  ...rest
}: FadeInViewProps) {
  const entrance = useEntrance(delay, distance, axis);

  return <Animated.View {...rest} style={[style, entrance]} />;
}

/* -------------------------------------------------------------------------- */
/* Pressable with spring feedback                                             */
/* -------------------------------------------------------------------------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = PressableProps & {
  /** When set, the element also fades and slides in after this many ms. */
  enterDelay?: number;
  scaleTo?: number;
};

/** Drop-in replacement for Pressable that springs down while pressed. */
export function PressableScale({
  enterDelay,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  scaleTo = 0.97,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const entrance = useEntrance(enterDelay, 12);

  const spring = (toValue: number) => {
    if (reduceMotion) return;

    Animated.spring(scale, {
      bounciness: 6,
      speed: 50,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  const resolvedStyle = typeof style === "function" ? style({ pressed, hovered }) : style;

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        setPressed(true);
        spring(scaleTo);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        spring(1);
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      style={[
        resolvedStyle,
        enterDelay !== undefined && entrance,
        { transform: [{ scale }, ...(enterDelay !== undefined ? entrance.transform : [])] },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Count-up number                                                            */
/* -------------------------------------------------------------------------- */

type AnimatedNumberProps = Omit<TextProps, "children"> & {
  decimals?: number;
  duration?: number;
  format: (value: number) => string;
  value: number;
};

/** Counts smoothly from its previous value to the new one. */
export function AnimatedNumber({
  decimals = 2,
  duration = 800,
  format,
  value,
  ...rest
}: AnimatedNumberProps) {
  const progress = useRef(new Animated.Value(reduceMotion ? value : 0)).current;
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    const id = progress.addListener(({ value: next }) => setDisplay(next));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(value);
      return;
    }

    Animated.timing(progress, {
      duration,
      easing: Easing.out(Easing.cubic),
      toValue: value,
      useNativeDriver: false, // drives text, not a native-animatable prop
    }).start();
  }, [duration, progress, value]);

  const factor = 10 ** decimals;

  return <Text {...rest}>{format(Math.round(display * factor) / factor)}</Text>;
}
