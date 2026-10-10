import { clearAuthSession } from "@/components/backendApi";
import DashboardBottomNav from "@/components/dashboardBottomNav";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, Stack, usePathname } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const dashboardMenu = [
  { label: "Dashboard", icon: "table-cells-large", slug: "home" },
  { label: "Referral Network", icon: "people-group", slug: "referrals" },
  { label: "Account Details", icon: "wallet", slug: "account" },
  // { label: "Account History", icon: "clock-rotate-left", slug: "history" },
  // { label: "Payment History", icon: "receipt", slug: "payment-history" },
  { label: "notification", icon: "message", slug: "notification" },
  { label: "Earnings / Bonuses", icon: "coins", slug: "earnings" },
  // { label: "Cash-Out", icon: "money-bill-transfer", slug: "cash-out" },
  { label: "Orders", icon: "bag-shopping", slug: "orders" },
  // { label: "Points History", icon: "star", slug: "points" },
  { label: "Products", icon: "basket-shopping", slug: "products" },
  { label: "Cart", icon: "cart-shopping", slug: "cart" },
  { label: "Profile", icon: "circle-user", slug: "profile" },
];

const getActiveBottomLabel = (pathname: string) => {
  const slug = pathname.split("/").filter(Boolean).at(-1) ?? "home";

  if (
    slug === "dashboard" ||
    slug === "referrals" ||
    slug === "orders" ||
    slug === "points"
  ) {
    return "Home";
  }

  if (slug === "products") return "Products";
  if (slug === "cart") return "Cart";
  if (["payments", "payment-history", "cash-out", "earnings"].includes(slug)) {
    return "Payments";
  }
  if (["profile", "account", "history", "notification"].includes(slug)) {
    return "Profile";
  }

  return "Home";
};

const getActiveMenuSlug = (pathname: string) => {
  const slug = pathname.split("/").filter(Boolean).at(-1);

  return slug === "dashboard" || !slug ? "home" : slug;
};

export default function DashboardLayout() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeBottomLabel = useMemo(
    () => getActiveBottomLabel(pathname),
    [pathname],
  );
  const activeMenuSlug = useMemo(() => getActiveMenuSlug(pathname), [pathname]);

  const openSection = (slug: string) => {
    setIsMenuOpen(false);

    if (slug === "home") {
      router.replace("/dashboard" as any);
      return;
    }

    router.replace(`/dashboard/${slug}` as any);
  };

  const logout = async () => {
    setIsMenuOpen(false);
    await clearAuthSession();
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open dashboard menu"
        activeOpacity={0.84}
        onPress={() => setIsMenuOpen(true)}
        style={styles.menuButton}
      >
        <FontAwesome6 name="bars" size={18} color="#1E3631" />
      </TouchableOpacity>

      {isMenuOpen ? (
        <View style={styles.drawerOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close dashboard menu"
            onPress={() => setIsMenuOpen(false)}
            style={styles.drawerBackdrop}
          />

          <View style={styles.drawerPanel}>
            <View style={styles.drawerBrand}>
              <View style={styles.drawerLogo}>
                <FontAwesome6 name="leaf" size={21} color="#172334" />
              </View>

              <View style={styles.drawerBrandCopy}>
                <Text style={styles.drawerBrandTitle}>Angel Foods</Text>
                <Text style={styles.drawerBrandSubtitle}>MEMBER PORTAL</Text>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                activeOpacity={0.8}
                onPress={() => setIsMenuOpen(false)}
                style={styles.drawerCloseButton}
              >
                <FontAwesome6 name="xmark" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.drawerItems}
            >
              {dashboardMenu.map((item) => {
                const isActive = activeMenuSlug === item.slug;

                return (
                  <TouchableOpacity
                    key={`${item.label}-${item.slug}`}
                    activeOpacity={0.84}
                    onPress={() => openSection(item.slug)}
                    style={[
                      styles.drawerItem,
                      isActive && styles.drawerItemActive,
                    ]}
                  >
                    <FontAwesome6
                      name={item.icon as any}
                      size={18}
                      color={isActive ? "#172334" : "#D0D7E0"}
                      style={styles.drawerItemIcon}
                    />
                    <Text
                      style={[
                        styles.drawerItemLabel,
                        isActive && styles.drawerItemLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.drawerDivider} />

              <TouchableOpacity
                activeOpacity={0.84}
                onPress={logout}
                style={styles.drawerItem}
              >
                <FontAwesome6
                  name="right-from-bracket"
                  size={18}
                  color="#D0D7E0"
                  style={styles.drawerItemIcon}
                />
                <Text style={styles.drawerItemLabel}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      ) : null}

      <DashboardBottomNav activeLabel={activeBottomLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  menuButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    top: 50,
    width: 42,
    zIndex: 40,
    elevation: 12,
    shadowColor: "#2F170F",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },

  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 100,
    elevation: 20,
  },

  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },

  drawerPanel: {
    backgroundColor: "#192536",
    height: "100%",
    maxWidth: 330,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    width: "82%",
    elevation: 16,
  },

  drawerBrand: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.12)",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 90,
    paddingHorizontal: 17,
    paddingTop: 8,
  },

  drawerLogo: {
    alignItems: "center",
    backgroundColor: "#FFB900",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  drawerBrandCopy: {
    flex: 1,
    marginLeft: 11,
  },

  drawerBrandTitle: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 17,
  },

  drawerBrandSubtitle: {
    color: "#B8C1CD",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 1,
  },

  drawerCloseButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 34,
    justifyContent: "center",
    width: 34,
  },

  drawerItems: {
    paddingBottom: 110,
    paddingHorizontal: 8,
    paddingTop: 14,
  },

  drawerItem: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 4,
    minHeight: 49,
    paddingHorizontal: 16,
  },

  drawerItemActive: {
    backgroundColor: "#FFB900",
  },

  drawerItemIcon: {
    marginRight: 15,
    textAlign: "center",
    width: 20,
  },

  drawerItemLabel: {
    color: "#F1F4F8",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  drawerItemLabelActive: {
    color: "#111827",
  },

  drawerDivider: {
    backgroundColor: "rgba(255,255,255,0.12)",
    height: 1,
    marginHorizontal: 12,
    marginVertical: 10,
  },
});
