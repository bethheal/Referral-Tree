import { orders } from "@/components/dashboardData";
import {
  accountHistory,
  financialSummary,
  paymentHistory,
} from "@/components/accountFeatureData";
import {
  getDashboardSummary,
  logoutSession,
  type DashboardApiSummary,
} from "@/components/backendApi";
import {
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  mockReferralLink,
  mockReferralTree,
  referralSystem,
} from "@/components/referralData";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
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

export default function Dashboard() {
  const greeting = getGreeting();
  const [hasCopiedReferralLink, setHasCopiedReferralLink] = useState(false);
  const [dashboardApiSummary, setDashboardApiSummary] =
    useState<DashboardApiSummary | null>(null);

  // ============================================================
  // DUMMY DASHBOARD DATA
  // ============================================================

  const summary = getMemberDashboardSummary(referralSystem, "user-1");
  const user = dashboardApiSummary?.account.fullName.split(" ")[0] ?? "User";
  const totalPoints =
    dashboardApiSummary?.financial.totalPoints ?? summary.totalPoints;
  const totalReferrals =
    dashboardApiSummary?.stats.totalReferrals ?? summary.totalTeamMembers;
  const totalLeads = dashboardApiSummary?.stats.totalLeads ?? 0;
  const currentEarnings =
    dashboardApiSummary?.financial.totalEarnings ??
    financialSummary.totalEarnings;
  const availableCashOut =
    dashboardApiSummary?.financial.availableBalance ??
    financialSummary.availableCashOut;
  const pendingPayments =
    dashboardApiSummary?.financial.pendingEarnings ??
    financialSummary.pendingPayments;
  const projectedCashOut = dashboardApiSummary
    ? dashboardApiSummary.financial.availableBalance +
      dashboardApiSummary.financial.pendingEarnings +
      dashboardApiSummary.financial.potentialEarnings
    : financialSummary.projectedCashOut;
  const referralLink = dashboardApiSummary?.referralLink ?? mockReferralLink;
  const latestActivity =
    accountHistory[0]?.title ?? paymentHistory[0]?.title ?? "No recent activity";
  const referralPreview =
    dashboardApiSummary?.referralPreview ??
    getMemberDirectReferrals(referralSystem, "user-1")
      .slice(0, 5)
      .map((member) => ({
        directReferrals: getMemberDirectReferrals(referralSystem, member.id).length,
        fullName: member.name,
        id: member.id,
        joinedAt: member.createdAt,
        status: member.status,
      }));

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

  const networkPreviewNodes = mockReferralTree.children.slice(0, 4);

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      await logoutSession();
      router.replace("/auth/login");
    } catch (error) {
      console.log("Logout failed:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    getDashboardSummary()
      .then((apiSummary) => {
        if (isMounted) {
          setDashboardApiSummary(apiSummary);
        }
      })
      .catch((error) => {
        console.log("Dashboard API unavailable, using local fallback:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    await Clipboard.setStringAsync(referralLink);
    setHasCopiedReferralLink(true);

    setTimeout(() => {
      setHasCopiedReferralLink(false);
    }, 1800);
  };

  const shareReferralLink = async () => {
    await Share.share({
      message: referralLink,
      url: referralLink,
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
          <View style={styles.headerIconButton} />

          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>
              {greeting}, {user}
            </Text>

            <Text style={styles.subGreeting}>Welcome back to Angel Foods</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Logout"
            activeOpacity={0.8}
            onPress={handleLogout}
            style={styles.headerIconButton}
          >
            <FontAwesome6 name="right-from-bracket" size={17} color="#192536" />
          </TouchableOpacity>
        </View>

        {/* ======================================================
            SCROLLABLE DASHBOARD
        ====================================================== */}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroTitle}>Dashboard</Text>
                <Text style={styles.heroSubtitle}>Your Angel Foods overview</Text>
              </View>

            </View>

            <View style={styles.heroMoneyRow}>
              <View style={styles.heroMoneyBlock}>
                <Text style={styles.heroMetricLabel}>Current Earnings</Text>
                <Text style={styles.heroMetricValue}>
                  GHS {currentEarnings.toLocaleString("en-GH")}
                </Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroMoneyBlock}>
                <Text style={styles.heroMetricLabel}>Cash-Out</Text>
                <Text style={styles.heroMetricValue}>
                  GHS {availableCashOut.toLocaleString("en-GH")}
                </Text>
              </View>
            </View>

            <View style={styles.heroMiniGrid}>
              <View style={styles.heroMiniCard}>
                <Text style={styles.heroMiniLabel}>Points</Text>
                <Text style={styles.heroMiniValue}>{totalPoints.toLocaleString()}</Text>
              </View>

              <View style={styles.heroMiniCard}>
                <Text style={styles.heroMiniLabel}>Referrals</Text>
                <Text style={styles.heroMiniValue}>
                  {totalReferrals.toLocaleString()}
                </Text>
              </View>

              <View style={styles.heroMiniCard}>
                <Text style={styles.heroMiniLabel}>Leads</Text>
                <Text style={styles.heroMiniValue}>{totalLeads.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <View style={styles.summaryIconWrap}>
                <FontAwesome6 name="wallet" size={14} color="#2D5B43" />
              </View>
              <Text style={styles.summaryTileLabel}>Available Balance</Text>
              <Text style={styles.summaryTileValue}>
                GHS {availableCashOut.toLocaleString("en-GH")}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.summaryIconWrap}>
                <FontAwesome6 name="hourglass-half" size={14} color="#A3671D" />
              </View>
              <Text style={styles.summaryTileLabel}>Pending Earnings</Text>
              <Text style={styles.summaryTileValue}>
                GHS {pendingPayments.toLocaleString("en-GH")}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.summaryIconWrap}>
                <FontAwesome6 name="chart-line" size={14} color="#192536" />
              </View>
              <Text style={styles.summaryTileLabel}>Potential Cash-Out</Text>
              <Text style={styles.summaryTileValue}>
                GHS {projectedCashOut.toLocaleString("en-GH")}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.summaryIconWrap}>
                <FontAwesome6 name="bolt" size={14} color="#4F46E5" />
              </View>
              <Text style={styles.summaryTileLabel}>Latest Activity</Text>
              <Text numberOfLines={2} style={styles.summaryTileValueSmall}>
                {latestActivity}
              </Text>
            </View>
          </View>

          <View style={styles.profilePrompt}>
            <View style={styles.profilePromptIcon}>
              <FontAwesome6 name="user-gear" size={16} color="#192536" />
            </View>

            <View style={styles.profilePromptCopy}>
              <Text style={styles.profilePromptTitle}>Complete your account profile</Text>
              <Text style={styles.profilePromptText}>
                Keep phone, payment, and security details ready for cash-out review.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openSection("account")}
              style={styles.profilePromptButton}
            >
              <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

         

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recent Referrals</Text>

              <Text style={styles.sectionSubtitle}>
                New activity in your network
              </Text>
            </View>

            <TouchableOpacity onPress={openReferrals}>
              <Text style={styles.sectionAction}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.referralPreviewGrid}>
            {referralPreview.map((referral, index) => (
              <TouchableOpacity
                key={referral.id}
                activeOpacity={0.86}
                onPress={openReferrals}
                style={styles.referralPreviewCard}
              >
                <Text style={styles.referralPreviewNumber}>{index + 1}</Text>
                <View style={styles.referralPreviewAvatar}>
                  <Text style={styles.referralPreviewInitial}>
                    {referral.fullName.charAt(0)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.referralPreviewName}>
                  {referral.fullName}
                </Text>
                <Text style={styles.referralPreviewMeta}>
                  {referral.directReferrals} referrals
                </Text>
              </TouchableOpacity>
            ))}
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
              <FontAwesome6 name="link" size={17} color="#192536" />
            </View>

            <Text style={styles.referralLabel}>YOUR REFERRAL LINK</Text>

            <View style={styles.linkBox}>
              <Text numberOfLines={1} style={styles.referralLink}>
                {referralLink}
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
                <FontAwesome6 name="share-nodes" size={13} color="#192536" />

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
                <FontAwesome6 name="sitemap" size={16} color="#192536" />
              </View>

              <View style={styles.networkSummaryCopy}>
                <Text style={styles.networkSummaryTitle}>
                  {totalReferrals} total referrals
                </Text>
                <Text style={styles.networkSummaryText}>
                  Preview is read-only. Open the full network to expand referrals
                  and view authorized details.
                </Text>
              </View>
            </View>

            <View style={styles.networkPreview}>
              <View style={[styles.networkPreviewRow, styles.networkPreviewRootRow]}>
                <View style={styles.networkPreviewRail}>
                  <View style={styles.networkPreviewDot} />
                </View>

                <View style={styles.networkPreviewIcon}>
                  <FontAwesome6 name="trophy" size={12} color="#FFFFFF" />
                </View>

                <View style={styles.networkPreviewCopy}>
                  <Text style={styles.networkPreviewName}>{mockReferralTree.name}</Text>
                  <Text style={styles.networkPreviewMeta}>
                    Root account - {mockReferralTree.children.length} direct referrals
                  </Text>
                </View>

                <View style={styles.networkPreviewStatus}>
                  <Text style={styles.networkPreviewStatusText}>
                    {mockReferralTree.children.length} of 4
                  </Text>
                </View>
              </View>

              <View style={styles.networkPreviewChildren}>
                {networkPreviewNodes.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    activeOpacity={0.85}
                    onPress={openReferrals}
                    style={styles.networkPreviewRow}
                  >
                    <View style={styles.networkPreviewRail}>
                      <View style={styles.networkPreviewDotMuted} />
                    </View>

                    <View style={styles.networkPreviewChevron}>
                      <FontAwesome6 name="chevron-right" size={9} color="#8B7F7A" />
                    </View>

                    <View style={styles.networkPreviewAvatar}>
                      <Text style={styles.networkPreviewAvatarText}>
                        {member.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </Text>
                    </View>

                    <View style={styles.networkPreviewCopy}>
                      <Text numberOfLines={1} style={styles.networkPreviewName}>
                        {member.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.networkPreviewMeta}>
                        Level {member.treeLevel} - {member.children.length} direct
                      </Text>
                    </View>

                    <View style={styles.networkPreviewProgress}>
                      <View style={styles.networkPreviewProgressTrack}>
                        <View
                          style={[
                            styles.networkPreviewProgressFill,
                            {
                              width: `${Math.min(
                                (member.children.length / 4) * 100,
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.networkPreviewProgressText}>
                        {member.children.length}/4
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* VIEW TREE BUTTON */}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openReferrals}
              style={styles.treeButton}
            >
              <Text style={styles.treeButtonText}>View Full Referral Tree</Text>

              <FontAwesome6 name="arrow-right" size={12} color="#192536" />
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
                    color="#192536"
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
                <FontAwesome6 name="bag-shopping" size={14} color="#192536" />
              </View>

              <View style={styles.orderInfo}>
                <Text style={styles.orderId}>{order.id}</Text>

                <Text style={styles.orderStatus}>{order.status}</Text>
              </View>

              <Text style={styles.orderTotal}>{order.total}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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

  headerCopy: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 12,
  },

  greeting: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 18,
    textAlign: "center",
  },

  subGreeting: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },

  headerIconButton: {
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
  // HERO
  // ============================================================

  heroCard: {
    backgroundColor: "#192536",
    borderRadius: 18,
    overflow: "hidden",
    padding: 18,
    shadowColor: "#7A170E",
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 8,
  },

  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  heroTitle: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 24,
  },

  heroSubtitle: {
    color: "#FFE6DF",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 1,
  },

  heroMoneyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    marginTop: 22,
  },

  heroMoneyBlock: {
    flex: 1,
  },

  heroMetricLabel: {
    color: "#FFD9D1",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  heroMetricValue: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 18,
    marginTop: 4,
  },

  heroDivider: {
    backgroundColor: "rgba(255,255,255,0.25)",
    height: 42,
    width: 1,
  },

  heroMiniGrid: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },

  heroMiniCard: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 62,
    padding: 10,
  },

  heroMiniLabel: {
    color: "#FFE6DF",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
  },

  heroMiniValue: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 16,
    marginTop: 6,
  },

  // ============================================================
  // TITLE
  // ============================================================

  titleSection: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  dashboardTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 22,
    letterSpacing: 0.5,
  },

  adminButton: {
    alignItems: "center",
    backgroundColor: "#1E3631",
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  adminButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  // ============================================================
  // POINTS
  // ============================================================

  pointsCard: {
    backgroundColor: "#192536",
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
  // DASHBOARD SUMMARY & MENU
  // ============================================================

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  summaryTile: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 104,
    padding: 12,
  },

  summaryIconWrap: {
    alignItems: "center",
    backgroundColor: "#FFF3EF",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    marginBottom: 10,
    width: 30,
  },

  summaryPrimaryTile: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
  },

  summaryPrimaryLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  summaryPrimaryValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
    marginTop: 9,
  },

  summaryTileLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  summaryTileValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 17,
    marginTop: 9,
  },

  summaryTileValueSmall: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },

  projectionNote: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 10,
    padding: 11,
  },

  profilePrompt: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    marginTop: 12,
    minHeight: 76,
    padding: 12,
  },

  profilePromptIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  profilePromptCopy: {
    flex: 1,
  },

  profilePromptTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  profilePromptText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },

  profilePromptButton: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  referralPreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  referralPreviewCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 118,
    overflow: "hidden",
    padding: 10,
    position: "relative",
  },

  referralPreviewNumber: {
    color: "#E7DDD9",
    fontFamily: "PoppinsBold",
    fontSize: 48,
    position: "absolute",
    right: 8,
    top: -5,
  },

  referralPreviewAvatar: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30,
  },

  referralPreviewInitial: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    textTransform: "uppercase",
  },

  referralPreviewName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 20,
  },

  referralPreviewMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 3,
  },

  menuToggle: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },

  menuToggleLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },

  menuToggleText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 10,
  },

  menuItem: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 9,
    minHeight: 58,
    paddingHorizontal: 11,
    position: "relative",
  },

  menuIconWrap: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  menuItemText: {
    color: "#314640",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 11,
    lineHeight: 15,
  },

  menuBadge: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: "absolute",
    right: 7,
    top: 6,
  },

  menuBadgeText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 8,
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
    color: "#192536",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#192536",
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
    color: "#192536",
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
    backgroundColor: "#FFFFFF",
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

  networkPreview: {
    backgroundColor: "#FBFDFD",
    borderColor: "#EDF1F0",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 8,
  },

  networkPreviewRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#EEF2F1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 8,
    marginVertical: 5,
    minHeight: 56,
    paddingHorizontal: 8,
  },

  networkPreviewRootRow: {
    borderColor: "#F0D6D0",
  },

  networkPreviewChildren: {
    borderLeftColor: "#E7EFED",
    borderLeftWidth: 1,
    marginLeft: 26,
    paddingLeft: 8,
  },

  networkPreviewRail: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 10,
  },

  networkPreviewDot: {
    backgroundColor: "#C9F6E7",
    borderRadius: 4,
    height: 8,
    width: 8,
  },

  networkPreviewDotMuted: {
    backgroundColor: "#E7EFED",
    borderRadius: 4,
    height: 8,
    width: 8,
  },

  networkPreviewChevron: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 18,
  },

  networkPreviewIcon: {
    alignItems: "center",
    backgroundColor: "#2EC9A3",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    marginHorizontal: 9,
    width: 30,
  },

  networkPreviewAvatar: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderColor: "#F0D6D0",
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    marginRight: 9,
    width: 30,
  },

  networkPreviewAvatarText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  networkPreviewCopy: {
    flex: 1,
    minWidth: 0,
  },

  networkPreviewName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  networkPreviewMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  networkPreviewStatus: {
    alignItems: "center",
    backgroundColor: "#E9FBF5",
    borderRadius: 9,
    minWidth: 46,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  networkPreviewStatusText: {
    color: "#2F7C50",
    fontFamily: "PoppinsBold",
    fontSize: 8,
  },

  networkPreviewProgress: {
    alignItems: "flex-end",
    marginLeft: 8,
    width: 58,
  },

  networkPreviewProgressTrack: {
    backgroundColor: "#EEF3F2",
    borderRadius: 7,
    height: 14,
    overflow: "hidden",
    width: 54,
  },

  networkPreviewProgressFill: {
    backgroundColor: "#C9F6E7",
    height: "100%",
  },

  networkPreviewProgressText: {
    color: "#6C625F",
    fontFamily: "PoppinsBold",
    fontSize: 8,
    marginTop: -12,
    paddingRight: 6,
  },

  treeContainer: {
    alignItems: "center",
  },

  treeRoot: {
    alignItems: "center",
  },

  rootCircle: {
    alignItems: "center",
    backgroundColor: "#192536",
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
    color: "#192536",
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
    backgroundColor: "#192536",
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
    color: "#192536",
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
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  // ============================================================
  // SIDE DRAWER
  // ============================================================

  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: -60,
    left: -18,
    right: -18,
    bottom: 0,
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
    width: "82%",
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
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
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 26,
  },

  drawerItem: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 4,
    minHeight: 49,
    paddingHorizontal: 16,
    position: "relative",
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

  drawerBadge: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  drawerBadgeText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  drawerDivider: {
    backgroundColor: "rgba(255,255,255,0.12)",
    height: 1,
    marginHorizontal: 12,
    marginVertical: 10,
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
    backgroundColor: "#192536",
    borderColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 5,
    height: 58,
    justifyContent: "center",
    marginTop: -28,

    shadowColor: "#192536",
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
    color: "#192536",
  },
});
