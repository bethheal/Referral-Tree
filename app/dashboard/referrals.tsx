import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getReferralLevelRows,
  getReferralTotal,
  mockReferralLink,
  mockReferralTree,
} from "@/components/referralData";
import ReferralTree from "@/components/referralTree";

const inviteCode = "25874123";

const topInvites = [
  { id: "1", name: "Aisha", earns: 420, rank: 2, color: "#3A8B5D" },
  { id: "2", name: "Rupali", earns: 520, rank: 1, color: "#D7B126" },
  { id: "3", name: "Sandy", earns: 180, rank: 3, color: "#C23122" },
];

const invitedFriends = [
  { id: "4", name: "Kimbo Prince", date: "Today", earns: 0 },
  { id: "5", name: "Amiya Equal", date: "Today", earns: 0 },
  { id: "6", name: "Romneya Fif", date: "Sep 16", earns: 0 },
  { id: "7", name: "Noshing Sour", date: "Sep 14", earns: 0 },
];

export default function MyReferrals() {
  const [hasCopiedInviteCode, setHasCopiedInviteCode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const totalReferrals = getReferralTotal(mockReferralTree);
  const levelRows = getReferralLevelRows(mockReferralTree);
  const lifetimeEarnings = 5912;
  const bonusTarget = 600;
  const progress = Math.min(totalReferrals / bonusTarget, 1);

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setHasCopiedInviteCode(true);

    setTimeout(() => {
      setHasCopiedInviteCode(false);
    }, 1800);
  };

  const shareInvite = async () => {
    await Share.share({
      message: `Join Angel Foods with my referral link: ${mockReferralLink}`,
      title: "Join Angel Foods",
      url: mockReferralLink,
    });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/dashboard" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={8}
            onPress={goBack}
            style={styles.headerButton}
          >
            <FontAwesome6 name="arrow-left" size={17} color="#261D1A" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Referral</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => setShowHelp((current) => !current)}
            style={[
              styles.headerButton,
              showHelp && styles.activeHeaderButton,
            ]}
          >
            <FontAwesome6
              name="question"
              size={13}
              color={showHelp ? "#FFFFFF" : "#261D1A"}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {showHelp ? (
            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>How referrals work</Text>
              <Text style={styles.helpText}>
                Share your code, your friend registers, and your rewards grow
                when they join your Angel Foods network.
              </Text>
            </View>
          ) : null}

          <View style={styles.totalCard}>
            <View style={styles.avatar}>
              <FontAwesome6 name="user" size={18} color="#1E3631" />
            </View>

            <View style={styles.totalCopy}>
              <Text style={styles.totalLabel}>Your total referral earnings</Text>
              <View style={styles.coinLine}>
                <View style={styles.coin}>
                  <FontAwesome6 name="dollar-sign" size={9} color="#FFFFFF" />
                </View>
                <Text style={styles.totalValue}>
                  {lifetimeEarnings.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.rewardStack}>
              <FontAwesome6 name="sack-dollar" size={36} color="#DDB542" />
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Refer & Earn</Text>
            <Text style={styles.heroTitle}>Unlimited money</Text>
            <Text style={styles.heroSubtitle}>
              Invite your friends and earn rewards easily
            </Text>
          </View>

          <View style={styles.earningCard}>
            <View style={styles.earningHeader}>
              <View style={styles.rewardIcon}>
                <FontAwesome6 name="gift" size={17} color="#F4C12D" />
              </View>

              <Text style={styles.earningTitle}>Referral Earning</Text>

              <Pressable
                onPress={() => setShowTree(true)}
                style={({ pressed }) => [
                  styles.topInviteButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.topInviteText}>Top Invite</Text>
              </Pressable>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Total Profit</Text>
                <View style={styles.coinLine}>
                  <View style={styles.smallCoin}>
                    <FontAwesome6 name="dollar-sign" size={7} color="#FFFFFF" />
                  </View>
                  <Text style={styles.metricValue}>
                    {Math.max(lifetimeEarnings - 728, 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Referred</Text>
                <Text style={styles.metricValue}>{totalReferrals}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Refer gift</Text>
                <Text style={styles.metricValue}>0.00</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { flex: progress }]} />
              <View style={{ flex: 1 - progress }} />
              <View style={styles.progressGift}>
                <FontAwesome6 name="gift" size={8} color="#C23122" />
              </View>
            </View>

            <Text style={styles.progressText}>
              Refer {bonusTarget} friends to win a bonus draw
            </Text>
          </View>

          <Text style={styles.shareLabel}>Share your friend</Text>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code</Text>
            <Text style={styles.codeValue}>{inviteCode}</Text>
            <Pressable
              onPress={copyInviteCode}
              style={({ pressed }) => [
                styles.copyButton,
                pressed && styles.pressed,
              ]}
            >
              <FontAwesome6 name="copy" size={15} color="#314640" />
            </Pressable>
          </View>

          {hasCopiedInviteCode ? (
            <Text style={styles.copyFeedback}>Invite code copied</Text>
          ) : null}

          <Pressable
            onPress={shareInvite}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6 name="share-nodes" size={13} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>

          <View style={styles.topBanner}>
            <View style={styles.bannerBadge}>
              <FontAwesome6 name="sack-dollar" size={22} color="#DDB542" />
            </View>
            <View style={styles.bannerCopy}>
              <Text style={styles.bannerLabel}>Lifetime Earnings</Text>
              <Text style={styles.bannerValue}>520</Text>
            </View>
            <FontAwesome6 name="crown" size={34} color="#F5B52A" />
          </View>

          <Text style={styles.sectionTitle}>Top Invites</Text>
          <View style={styles.invitePodium}>
            {topInvites.map((invite) => (
              <View key={invite.id} style={styles.podiumPerson}>
                <View
                  style={[
                    styles.podiumAvatar,
                    { borderColor: invite.color },
                    invite.rank === 1 && styles.firstAvatar,
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {invite.name.charAt(0)}
                  </Text>
                  <View
                    style={[styles.rankBadge, { backgroundColor: invite.color }]}
                  >
                    <Text style={styles.rankText}>{invite.rank}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.podiumName}>
                  {invite.name}
                </Text>
                <View style={styles.coinLine}>
                  <View style={styles.smallCoin}>
                    <FontAwesome6 name="dollar-sign" size={7} color="#FFFFFF" />
                  </View>
                  <Text style={styles.podiumEarns}>{invite.earns}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.invitedHeader}>
            <View style={styles.invitedTitleRow}>
              <Text style={styles.sectionTitle}>Invited Friends</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{totalReferrals}</Text>
              </View>
            </View>
            <FontAwesome6 name="sliders" size={15} color="#1E3631" />
          </View>

          <View style={styles.friendList}>
            {invitedFriends.map((friend) => (
              <View key={friend.id} style={styles.friendRow}>
                <Text style={styles.friendRank}>{friend.id}</Text>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitial}>
                    {friend.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.friendCopy}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendMeta}>
                    Registered - {friend.date}
                  </Text>
                </View>
                <View style={styles.friendEarns}>
                  <Text style={styles.friendEarnLabel}>Earn you get</Text>
                  <View style={styles.coinLine}>
                    <View style={styles.smallCoin}>
                      <FontAwesome6 name="dollar-sign" size={7} color="#FFFFFF" />
                    </View>
                    <Text style={styles.friendEarnValue}>{friend.earns}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelTitle}>Network Levels</Text>
              <Pressable
                onPress={() => setShowTree((current) => !current)}
                style={({ pressed }) => [
                  styles.treeToggle,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.treeToggleText}>
                  {showTree ? "Hide Tree" : "View Tree"}
                </Text>
              </Pressable>
            </View>

            {levelRows.map((row) => (
              <View key={row.level} style={styles.levelRow}>
                <Text style={styles.levelLabel}>{row.label}</Text>
                <Text style={styles.levelValue}>{row.people}</Text>
              </View>
            ))}

            {showTree ? (
              <View style={styles.treeWrap}>
                <ReferralTree data={mockReferralTree} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF8F2",
    flex: 1,
  },

  screen: {
    flex: 1,
    paddingHorizontal: 22,
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 26,
  },

  headerButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    shadowColor: "#2F170F",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: 44,
  },

  activeHeaderButton: {
    backgroundColor: "#C23122",
  },

  pressed: {
    opacity: 0.72,
  },

  headerTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 18,
  },

  scrollContent: {
    paddingBottom: 34,
  },

  helpCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },

  helpTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  helpText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  totalCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  avatar: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },

  totalCopy: {
    flex: 1,
    marginLeft: 12,
  },

  totalLabel: {
    color: "#314640",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
  },

  coinLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },

  coin: {
    alignItems: "center",
    backgroundColor: "#D7B126",
    borderColor: "#F5E3A8",
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },

  totalValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 18,
  },

  rewardStack: {
    alignItems: "center",
    width: 48,
  },

  heroCopy: {
    alignItems: "center",
    marginBottom: 20,
  },

  heroTitle: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 28,
    lineHeight: 38,
  },

  heroSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 4,
  },

  earningCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 20,
    padding: 14,
  },

  earningHeader: {
    alignItems: "center",
    flexDirection: "row",
  },

  rewardIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginRight: 10,
    width: 36,
  },

  earningTitle: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  topInviteButton: {
    backgroundColor: "#C23122",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },

  topInviteText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  metricRow: {
    flexDirection: "row",
    marginTop: 18,
  },

  metric: {
    flex: 1,
  },

  metricLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginBottom: 4,
  },

  metricValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 19,
  },

  divider: {
    backgroundColor: "#F1E8E4",
    height: 42,
    marginHorizontal: 8,
    width: 1,
  },

  smallCoin: {
    alignItems: "center",
    backgroundColor: "#D7B126",
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    width: 16,
  },

  progressTrack: {
    alignItems: "center",
    backgroundColor: "#F1E8E4",
    borderRadius: 7,
    flexDirection: "row",
    height: 10,
    marginTop: 16,
    overflow: "hidden",
  },

  progressFill: {
    backgroundColor: "#C23122",
    height: "100%",
    minWidth: 78,
  },

  progressGift: {
    alignItems: "center",
    backgroundColor: "#D7B126",
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 16,
  },

  progressText: {
    alignSelf: "center",
    backgroundColor: "#FFF8F2",
    borderRadius: 9,
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 13,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },

  shareLabel: {
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 16,
    marginBottom: 10,
  },

  codeCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F2",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingLeft: 14,
  },

  codeLabel: {
    color: "#8B7F7A",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 13,
  },

  codeValue: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },

  copyButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 11,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginLeft: 12,
    width: 44,
  },

  copyFeedback: {
    color: "#3A8B5D",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginTop: 7,
  },

  shareButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 44,
  },

  shareButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  topBanner: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 12,
    flexDirection: "row",
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },

  bannerCopy: {
    flex: 1,
    marginLeft: 12,
  },

  bannerLabel: {
    color: "#FFFFFF",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },

  bannerValue: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 18,
  },

  sectionTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 21,
    marginBottom: 10,
    marginTop: 20,
  },

  invitePodium: {
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: 154,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },

  podiumPerson: {
    alignItems: "center",
    flex: 1,
  },

  podiumAvatar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 3,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  firstAvatar: {
    height: 56,
    width: 56,
  },

  avatarInitial: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  rankBadge: {
    alignItems: "center",
    borderRadius: 10,
    bottom: -8,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    width: 20,
  },

  rankText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  podiumName: {
    color: "#314640",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    marginTop: 14,
    maxWidth: 80,
  },

  podiumEarns: {
    color: "#314640",
    fontFamily: "PoppinsRegular",
    fontSize: 14,
  },

  invitedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  invitedTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  countPill: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    marginTop: 10,
    minWidth: 24,
    paddingHorizontal: 6,
  },

  countPillText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  friendList: {
    backgroundColor: "#FFF8F2",
  },

  friendRow: {
    alignItems: "center",
    borderBottomColor: "#F1E8E4",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 68,
  },

  friendRank: {
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
    width: 22,
  },

  friendAvatar: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },

  friendInitial: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 15,
  },

  friendCopy: {
    flex: 1,
    marginLeft: 12,
  },

  friendName: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  friendMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  friendEarns: {
    alignItems: "flex-end",
  },

  friendEarnLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  friendEarnValue: {
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 16,
  },

  levelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  levelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  levelTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 16,
    marginBottom: 6,
    marginTop: 4,
  },

  treeToggle: {
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  treeToggleText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  levelRow: {
    alignItems: "center",
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },

  levelLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
  },

  levelValue: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  treeWrap: {
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 12,
  },
});
