import { bottomNavItems } from "@/components/dashboardData";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DashboardBottomNavProps = {
  activeLabel: string;
};

type DashboardNavItemProps = {
  icon: string;
  isActive: boolean;
  isHome: boolean;
  label: string;
  onPress: () => void;
};

function DashboardNavItem({
  icon,
  isActive,
  isHome,
  label,
  onPress,
}: DashboardNavItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      friction: 5,
      tension: 130,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
      }}
    >
      <Pressable
        onHoverIn={() => animateTo(1.08)}
        onHoverOut={() => animateTo(1)}
        onPress={onPress}
        onPressIn={() => animateTo(0.94)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.navItem,
          isHome && styles.homeNavItem,
        ]}
      >
        <View
          style={[
            styles.navIconWrap,
            isHome && styles.homeNavIconWrap,
            isActive &&
              !isHome &&
              styles.activeNavIconWrap,
          ]}
        >
          <FontAwesome6
            name={icon as any}
            size={isHome ? 19 : 16}
            color={
              isHome
                ? "#FFFFFF"
                : isActive
                ? "#C23122"
                : "#B9AAA4"
            }
          />
        </View>

        <Text
          style={[
            styles.navLabel,
            isActive && styles.activeNavLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DashboardBottomNav({
  activeLabel,
}: DashboardBottomNavProps) {
  const openSection = (slug: string) => {
    if (slug === "home") {
      router.replace("/dashboard" as any);
      return;
    }

    router.replace(`/dashboard/${slug}` as any);
  };

  return (
    <View style={styles.bottomNav}>
      {bottomNavItems.map((item) => {
        const isActive = activeLabel === item.label;
        const isHome = item.label === "Home";

        return (
          <DashboardNavItem
            key={item.label}
            icon={item.icon}
            isActive={isActive}
            isHome={isHome}
            label={item.label}
            onPress={() => openSection(item.slug)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    bottom: 18,
    flexDirection: "row",
    height: 72,
    justifyContent: "space-around",
    left: 18,
    position: "absolute",
    right: 18,

    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,

    elevation: 8,
  },

  navItem: {
    alignItems: "center",
    gap: 5,
    minWidth: 52,
  },

  homeNavItem: {
    marginTop: -28,
  },

  navIconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  activeNavIconWrap: {
    backgroundColor: "#FFF1EF",
  },

  homeNavIconWrap: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 5,
    height: 58,
    justifyContent: "center",

    shadowColor: "#C23122",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 14,

    width: 58,
    elevation: 9,
  },

  navLabel: {
    color: "#B9AAA4",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  activeNavLabel: {
    color: "#C23122",
  },
});

