import { bottomNavItems, orders } from "@/components/dashboardData";
import {
  getReferralLevelRows,
  getReferralTotal,
  mockReferralLink,
  mockReferralTree,
} from "@/components/referralData";
import ReferralTree from "@/components/referralTree";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onHoverIn={() => animateTo(1.08)}
        onHoverOut={() => animateTo(1)}
        onPress={onPress}
        onPressIn={() => animateTo(0.94)}
        onPressOut={() => animateTo(1)}
        style={styles.navItem}
      >
        <View
          style={[
            styles.navIconWrap,
            isHome && styles.homeNavIconWrap,
            isActive && !isHome && styles.activeNavIconWrap,
          ]}
        >
          <FontAwesome6
            name={icon as any}
            size={isHome ? 19 : 16}
            color={isHome ? "#FFFFFF" : isActive ? "#C23122" : "#B9AAA4"}
          />
        </View>

        <Text style={[styles.navLabel, isActive && styles.activeNavLabel]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function Dashboard() {
  const greeting = getGreeting();
  const [hasCopiedReferralLink, setHasCopiedReferralLink] = useState(false);

  // Temporary user name.
  // Later this can come from your authentication data.
  const user = "User";

  // ============================================================
  // DUMMY DASHBOARD DATA
  // ============================================================

  const totalPoints = 1250;
  const totalReferrals = getReferralTotal(mockReferralTree);
  const totalEarnings = 100;
  const currentLevel = 3;

  const recentActivity = [
    {
      id: "1",
      icon: "user-plus",
      title: "John joined your network",
      time: "2 hours ago",
      points: "+20",
    },
    {
      id: "2",
      icon: "cart-shopping",
      title: "Mary made a purchase",
      time: "Yesterday",
      points: "+20",
    },
    {
      id: "3",
      icon: "user-plus",
      title: "Sarah referred a friend",
      time: "2 days ago",
      points: "+20",
    },
  ];

  const networkLevels = getReferralLevelRows(mockReferralTree);

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      // Remove saved login status
      await AsyncStorage.removeItem("loggedIn");

      // Go back to login page
      router.replace("/auth/login");
    } catch (error) {
      console.log("Logout failed:", error);
    }
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const openSection = (slug: string) => {
    if (slug === "home") {
      return;
    }

    router.push(`/dashboard/${slug}` as any);
  };

  const openReferrals = () => {
    router.push("/dashboard/referrals" as any);
  };

  const copyReferralLink = async () => {
    await Clipboard.setStringAsync(mockReferralLink);
    setHasCopiedReferralLink(true);

    setTimeout(() => {
      setHasCopiedReferralLink(false);
    }, 1800);
  };

  const shareReferralLink = async () => {
    await Share.share({
      message: mockReferralLink,
      url: mockReferralLink,
      title: "Join Angel Foods",
    });
  };

  // ============================================================
  // DASHBOARD
  // ============================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {/* ======================================================
            HEADER
        ====================================================== */}

        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>
              {greeting}, {user}
            </Text>

            <Text style={styles.subGreeting}>Welcome back to Angel Foods</Text>
          </View>

          {/* LOGOUT BUTTON */}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            style={styles.notificationButton}
          >
            <FontAwesome6 name="right-from-bracket" size={17} color="#C23122" />
          </TouchableOpacity>
        </View>

        {/* ======================================================
            SCROLLABLE DASHBOARD
        ====================================================== */}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ====================================================
              DASHBOARD TITLE
          ==================================================== */}

          <View style={styles.titleSection}>
            <Text style={styles.dashboardTitle}>DASHBOARD</Text>
          </View>

          {/* ====================================================
              POINTS HERO
          ==================================================== */}

          <View style={styles.pointsCard}>
            <View style={styles.pointsTop}>
              <View style={styles.pointsIcon}>
                <FontAwesome6 name="star" size={18} color="#D7B126" />
              </View>

              <Text style={styles.pointsLabel}>TOTAL POINTS</Text>
            </View>

            <Text style={styles.pointsValue}>
              {totalPoints.toLocaleString()}
            </Text>

            <Text style={styles.pointsDescription}>
              Keep referring friends and shopping to grow your rewards.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openSection("points")}
              style={styles.pointsButton}
            >
              <Text style={styles.pointsButtonText}>View Points History</Text>

              <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* ====================================================
              QUICK STATS
          ==================================================== */}

          <View style={styles.statsRow}>
            {/* REFERRALS */}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openReferrals}
              style={styles.statCard}
            >
              <View style={styles.statIcon}>
                <FontAwesome6 name="users" size={15} color="#C23122" />
              </View>

              <Text style={styles.statValue}>{totalReferrals}</Text>

              <Text style={styles.statLabel}>Referrals</Text>
            </TouchableOpacity>

            {/* EARNINGS */}

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <FontAwesome6 name="coins" size={15} color="#D7B126" />
              </View>

              <Text style={styles.statValue}>{totalEarnings}</Text>

              <Text style={styles.statLabel}>Earned</Text>
            </View>

            {/* NETWORK LEVEL */}

            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <FontAwesome6 name="layer-group" size={15} color="#C23122" />
              </View>

              <Text style={styles.statValue}>{currentLevel}</Text>

              <Text style={styles.statLabel}>Network Level</Text>
            </View>
          </View>

          {/* ====================================================
              INVITE & EARN
          ==================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Invite & Earn</Text>

              <Text style={styles.sectionSubtitle}>
                Share your referral link
              </Text>
            </View>
          </View>

          <View style={styles.referralCard}>
            <View style={styles.referralIcon}>
              <FontAwesome6 name="link" size={17} color="#C23122" />
            </View>

            <Text style={styles.referralLabel}>YOUR REFERRAL LINK</Text>

            <View style={styles.linkBox}>
              <Text numberOfLines={1} style={styles.referralLink}>
                {mockReferralLink}
              </Text>
            </View>

            {hasCopiedReferralLink ? (
              <Text style={styles.copyFeedback}>Copied!</Text>
            ) : null}

            <View style={styles.referralButtons}>
              {/* COPY */}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={copyReferralLink}
                style={styles.copyButton}
              >
                <FontAwesome6 name="copy" size={13} color="#FFFFFF" />

                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>

              {/* SHARE */}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={shareReferralLink}
                style={styles.shareButton}
              >
                <FontAwesome6 name="share-nodes" size={13} color="#C23122" />

                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ====================================================
              NETWORK
          ==================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your Network</Text>

              <Text style={styles.sectionSubtitle}>
                People in your referral tree
              </Text>
            </View>

            <TouchableOpacity onPress={openReferrals}>
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.networkCard}>
            <View style={styles.networkSummary}>
              <View style={styles.networkSummaryIcon}>
                <FontAwesome6 name="sitemap" size={16} color="#C23122" />
              </View>

              <View style={styles.networkSummaryCopy}>
                <Text style={styles.networkSummaryTitle}>
                  {totalReferrals} total referrals
                </Text>
                <Text style={styles.networkSummaryText}>
                  Tap members in the tree to expand or collapse each level.
                </Text>
              </View>
            </View>

            <View style={styles.treeContainer}>
              <ReferralTree data={mockReferralTree} compact />
            </View>

            {/* LEVEL BREAKDOWN */}

            <View style={styles.levelList}>
              {networkLevels.map((item) => (
                <View key={item.level} style={styles.levelRow}>
                  <View style={styles.levelLeft}>
                    <View style={styles.levelDot} />

                    <Text style={styles.levelName}>{item.label}</Text>
                  </View>

                  <Text style={styles.levelPeople}>{item.people} people</Text>
                </View>
              ))}
            </View>

            {/* VIEW TREE BUTTON */}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openReferrals}
              style={styles.treeButton}
            >
              <Text style={styles.treeButtonText}>View Full Referral Tree</Text>

              <FontAwesome6 name="arrow-right" size={12} color="#C23122" />
            </TouchableOpacity>
          </View>

          {/* ====================================================
              RECENT ACTIVITY
          ==================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent Activity</Text>

              <Text style={styles.sectionSubtitle}>
                Latest activity in your network
              </Text>
            </View>

            <TouchableOpacity onPress={() => openSection("activity")}>
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {recentActivity.map((activity, index) => (
              <View
                key={activity.id}
                style={[
                  styles.activityRow,
                  index !== recentActivity.length - 1 && styles.activityBorder,
                ]}
              >
                <View style={styles.activityIcon}>
                  <FontAwesome6
                    name={activity.icon as any}
                    size={13}
                    color="#C23122"
                  />
                </View>

                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>

                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>

                <Text style={styles.activityPoints}>{activity.points}</Text>
              </View>
            ))}
          </View>

          {/* ====================================================
              RECENT ORDERS
          ==================================================== */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent Orders</Text>

              <Text style={styles.sectionSubtitle}>
                Your latest Angel Foods purchases
              </Text>
            </View>

            <TouchableOpacity onPress={() => openSection("orders")}>
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          {orders.slice(0, 2).map((order) => (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.85}
              onPress={() => openSection("orders")}
              style={styles.orderCard}
            >
              <View style={styles.orderIcon}>
                <FontAwesome6 name="bag-shopping" size={14} color="#C23122" />
              </View>

              <View style={styles.orderInfo}>
                <Text style={styles.orderId}>{order.id}</Text>

                <Text style={styles.orderStatus}>{order.status}</Text>
              </View>

              <Text style={styles.orderTotal}>{order.total}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ======================================================
            BOTTOM NAVIGATION
        ====================================================== */}

        <View style={styles.bottomNav}>
          {bottomNavItems.map((item) => {
            const isActive = item.label === "Home";
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F2",
  },

  screen: {
    flex: 1,
    paddingHorizontal: 18,
    marginTop: 60,
  },

  // ============================================================
  // HEADER
  // ============================================================

  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  greeting: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 21,
  },

  subGreeting: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 3,
  },

  notificationButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    width: 42,
  },

  // ============================================================
  // SCROLL
  // ============================================================

  scrollContent: {
    paddingBottom: 120,
  },

  // ============================================================
  // TITLE
  // ============================================================

  titleSection: {
    marginBottom: 14,
  },

  dashboardTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 22,
    letterSpacing: 0.5,
  },

  // ============================================================
  // POINTS
  // ============================================================

  pointsCard: {
    backgroundColor: "#C23122",
    borderRadius: 22,
    overflow: "hidden",
    padding: 20,
  },

  pointsTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },

  pointsIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },

  pointsLabel: {
    color: "#FFE9DF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    letterSpacing: 0.7,
  },

  pointsValue: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 38,
    marginTop: 12,
  },

  pointsDescription: {
    color: "#FFE9DF",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    lineHeight: 18,
    maxWidth: "85%",
    marginTop: 2,
  },

  pointsButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#A8271A",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  pointsButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  // ============================================================
  // STATS
  // ============================================================

  statsRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    flex: 1,
    padding: 13,
  },

  statIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    width: 30,
  },

  statValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
    marginTop: 9,
  },

  statLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 1,
  },

  // ============================================================
  // SECTIONS
  // ============================================================

  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 17,
  },

  sectionSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 1,
  },

  sectionAction: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  // ============================================================
  // REFERRAL
  // ============================================================

  referralCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 16,
  },

  referralIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 11,
    height: 35,
    justifyContent: "center",
    width: 35,
  },

  referralLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginTop: 12,
  },

  linkBox: {
    backgroundColor: "#FFF8F2",
    borderColor: "#F0E4DF",
    borderRadius: 11,
    borderWidth: 1,
    marginTop: 7,
    padding: 11,
  },

  referralLink: {
    color: "#314640",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },

  copyFeedback: {
    color: "#3A8B5D",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginTop: 7,
  },

  referralButtons: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },

  copyButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 11,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 11,
  },

  copyButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  shareButton: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 11,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 11,
  },

  shareButtonText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  // ============================================================
  // NETWORK
  // ============================================================

  networkCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 16,
  },

  networkSummary: {
    alignItems: "center",
    backgroundColor: "#FFF8F2",
    borderColor: "#F0E4DF",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 14,
    padding: 12,
  },

  networkSummaryIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  networkSummaryCopy: {
    flex: 1,
    marginLeft: 10,
  },

  networkSummaryTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  networkSummaryText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },

  treeContainer: {
    alignItems: "center",
  },

  treeRoot: {
    alignItems: "center",
  },

  rootCircle: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    width: 50,
  },

  rootText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    marginTop: 5,
  },

  treeLine: {
    backgroundColor: "#E9D9D3",
    height: 22,
    width: 1,
  },

  childrenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "78%",
  },

  treePerson: {
    alignItems: "center",
  },

  childCircle: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderColor: "#F0D6D0",
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },

  childLetter: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  childText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 4,
  },

  levelList: {
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 5,
  },

  levelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
  },

  levelLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  levelDot: {
    backgroundColor: "#C23122",
    borderRadius: 4,
    height: 7,
    width: 7,
  },

  levelName: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  levelPeople: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
  },

  treeButton: {
    alignItems: "center",
    borderColor: "#F0D6D0",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
    paddingVertical: 11,
  },

  treeButtonText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  // ============================================================
  // ACTIVITY
  // ============================================================

  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    paddingHorizontal: 15,
  },

  activityRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 67,
  },

  activityBorder: {
    borderBottomColor: "#F1E8E4",
    borderBottomWidth: 1,
  },

  activityIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 11,
    height: 35,
    justifyContent: "center",
    width: 35,
  },

  activityInfo: {
    flex: 1,
    marginLeft: 10,
  },

  activityTitle: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  activityTime: {
    color: "#A69A95",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  activityPoints: {
    color: "#3A8B5D",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  // ============================================================
  // ORDERS
  // ============================================================

  orderCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    marginBottom: 9,
    padding: 13,
  },

  orderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 35,
    justifyContent: "center",
    width: 35,
  },

  orderInfo: {
    flex: 1,
    marginLeft: 10,
  },

  orderId: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  orderStatus: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 2,
  },

  orderTotal: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  // ============================================================
  // BOTTOM NAVIGATION
  // ============================================================

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
    marginTop: -28,

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
