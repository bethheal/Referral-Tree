import {
  getAdminSummary,
  getMemberDirectReferrals,
  getMemberEarnings,
  getMemberPoints,
  getPlacementChildren,
  getTreeMembers,
  mockReferralTree,
  referralSystem,
  updateCommissionStatus,
  updateMemberStatus,
  updateProductCommission,
  validateReferralIntegrity,
} from "@/components/referralData";
import ReferralTree from "@/components/referralTree";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const formatMoney = (amount: number) =>
  `$${amount.toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;

export default function AdminDashboard() {
  const [query, setQuery] = useState("");
  const [, setRevision] = useState(0);
  const adminSummary = getAdminSummary(referralSystem);
  const integrity = validateReferralIntegrity(referralSystem);
  const rootTree = referralSystem.trees[0];
  const treeMembers = getTreeMembers(referralSystem, rootTree.id);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedMember = normalizedQuery
    ? referralSystem.users.find(
        (user) =>
          user.name.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery) ||
          user.referralCode.toLowerCase().includes(normalizedQuery)
      ) ?? referralSystem.users[0]
    : referralSystem.users[0];
  const sponsor = selectedMember.sponsorId
    ? referralSystem.users.find((user) => user.id === selectedMember.sponsorId)
    : null;
  const placementParent = selectedMember.placementParentId
    ? referralSystem.users.find(
        (user) => user.id === selectedMember.placementParentId
      )
    : null;
  const directReferrals = getMemberDirectReferrals(
    referralSystem,
    selectedMember.id
  );
  const placementChildren = getPlacementChildren(
    referralSystem,
    selectedMember.id
  );
  const earnings = getMemberEarnings(referralSystem, selectedMember.id);
  const points = getMemberPoints(referralSystem, selectedMember.id);
  const latestCommission = referralSystem.commissions[0];

  const refresh = () => setRevision((current) => current + 1);

  const setMemberStatus = (status: "ACTIVE" | "SUSPENDED") => {
    updateMemberStatus(referralSystem, selectedMember.id, status);
    refresh();
  };

  const setCommissionStatus = (
    commissionId: string,
    status: "AVAILABLE" | "PAID" | "VOID"
  ) => {
    updateCommissionStatus(referralSystem, commissionId, status);
    refresh();
  };

  const toggleLevelFiveCommission = () => {
    const levelFive = referralSystem.products.find((product) => product.level === 5);

    if (!levelFive) {
      return;
    }

    updateProductCommission(
      referralSystem,
      levelFive.id,
      levelFive.commissionAmount === 120 ? 125 : 120
    );
    refresh();
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
            activeOpacity={0.75}
            hitSlop={8}
            onPress={goBack}
            style={styles.headerButton}
          >
            <FontAwesome6 name="arrow-left" size={16} color="#1E3631" />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              Referral, placement, commission, and points controls
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.metricsGrid}>
            <Metric label="Members" value={adminSummary.totalMembers} />
            <Metric label="Trees" value={adminSummary.totalReferralTrees} />
            <Metric label="Active" value={adminSummary.activeTrees} />
            <Metric label="Full" value={adminSummary.fullTrees} />
            <Metric label="Referrals" value={adminSummary.totalReferrals} />
            <Metric
              label="Commissions"
              value={formatMoney(adminSummary.totalCommissions)}
            />
            <Metric
              label="Pending"
              value={formatMoney(adminSummary.pendingCommissions)}
            />
            <Metric label="Points" value={adminSummary.totalPoints} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tree Controls</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{rootTree.status}</Text>
              </View>
            </View>

            <View style={styles.capacityRow}>
              <View>
                <Text style={styles.capacityValue}>
                  {rootTree.memberCount}/{rootTree.maxMembers}
                </Text>
                <Text style={styles.capacityLabel}>Tree capacity</Text>
              </View>
              <Text style={styles.capacityNote}>
                Four direct placement children per member. Overflow fills level
                by level from left to right.
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { flex: rootTree.memberCount / rootTree.maxMembers },
                ]}
              />
              <View
                style={{
                  flex: 1 - rootTree.memberCount / rootTree.maxMembers,
                }}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Search</Text>
            <View style={styles.searchBox}>
              <FontAwesome6 name="magnifying-glass" size={13} color="#8B7F7A" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, email, or referral code"
                placeholderTextColor="#A69A95"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.memberPanel}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {selectedMember.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{selectedMember.name}</Text>
                <Text style={styles.memberMeta}>
                  {selectedMember.referralCode} - Product L
                  {selectedMember.productLevel}
                </Text>
              </View>
            </View>

            <InfoRow label="Sponsor" value={sponsor?.name ?? "None"} />
            <InfoRow
              label="Placement parent"
              value={placementParent?.name ?? "None"}
            />
            <InfoRow
              label="Direct referrals"
              value={`${directReferrals.length}`}
            />
            <InfoRow
              label="Placement children"
              value={`${placementChildren.length}/4`}
            />
            <InfoRow label="Tree level" value={`${selectedMember.treeLevel}`} />
            <InfoRow label="Earnings" value={formatMoney(earnings.total)} />
            <InfoRow label="Points" value={`${points}`} />

            <View style={styles.controlRow}>
              <Pressable
                onPress={() => setMemberStatus("ACTIVE")}
                style={({ pressed }) => [
                  styles.actionButton,
                  selectedMember.status === "ACTIVE" && styles.activeActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    selectedMember.status === "ACTIVE" &&
                      styles.activeActionButtonText,
                  ]}
                >
                  Activate
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMemberStatus("SUSPENDED")}
                style={({ pressed }) => [
                  styles.actionButton,
                  selectedMember.status === "SUSPENDED" &&
                    styles.dangerActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    selectedMember.status === "SUSPENDED" &&
                      styles.activeActionButtonText,
                  ]}
                >
                  Suspend
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Admin Actions</Text>
              <View
                style={[
                  styles.statusPill,
                  !integrity.passed && styles.dangerPill,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    !integrity.passed && styles.dangerPillText,
                  ]}
                >
                  {integrity.passed ? "AUDIT PASSED" : "AUDIT REVIEW"}
                </Text>
              </View>
            </View>

            <View style={styles.actionStack}>
              <Pressable
                disabled={!latestCommission}
                onPress={() => {
                  if (latestCommission) {
                    setCommissionStatus(latestCommission.id, "PAID");
                  }
                }}
                style={({ pressed }) => [
                  styles.wideAction,
                  pressed && styles.pressed,
                ]}
              >
                <FontAwesome6 name="money-check-dollar" size={13} color="#FFFFFF" />
                <Text style={styles.wideActionText}>
                  Mark latest commission paid
                </Text>
              </Pressable>

              <Pressable
                onPress={toggleLevelFiveCommission}
                style={({ pressed }) => [
                  styles.secondaryWideAction,
                  pressed && styles.pressed,
                ]}
              >
                <FontAwesome6 name="sliders" size={13} color="#C23122" />
                <Text style={styles.secondaryWideActionText}>
                  Toggle Level 5 commission config
                </Text>
              </Pressable>
            </View>

            {integrity.issues.length > 0 ? (
              integrity.issues.map((issue) => (
                <Text key={issue} style={styles.auditIssue}>
                  {issue}
                </Text>
              ))
            ) : (
              <Text style={styles.auditClear}>
                No duplicate placement slots, overfilled parents, self-referrals,
                full-tree violations, or duplicate payout references detected.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Levels</Text>
            {referralSystem.products.map((product) => (
              <View key={product.id} style={styles.productRow}>
                <View>
                  <Text style={styles.productName}>
                    Level {product.level} - {product.name}
                  </Text>
                  <Text style={styles.productMeta}>
                    {product.potentialAffiliates.toLocaleString()} potential
                    affiliates
                  </Text>
                </View>
                <View style={styles.productAmounts}>
                  <Text style={styles.productPrice}>
                    {formatMoney(product.price)}
                  </Text>
                  <Text style={styles.productCommission}>
                    {formatMoney(product.commissionAmount)} commission
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Commission Audit</Text>
            {referralSystem.commissions.slice(0, 8).map((commission) => {
              const recipient = referralSystem.users.find(
                (user) => user.id === commission.recipientId
              );
              const source = referralSystem.users.find(
                (user) => user.id === commission.sourceUserId
              );

              return (
                <AuditRow
                  key={commission.id}
                  title={`${commission.commissionType} - ${formatMoney(
                    commission.amount
                  )}`}
                  meta={`${recipient?.name ?? "Unknown"} earned from ${
                    source?.name ?? "Unknown"
                  }`}
                  status={commission.status}
                  onPay={() => setCommissionStatus(commission.id, "PAID")}
                  onRestore={() =>
                    setCommissionStatus(commission.id, "AVAILABLE")
                  }
                  onVoid={() => setCommissionStatus(commission.id, "VOID")}
                />
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Placement Audit</Text>
            {referralSystem.placements.slice(-8).reverse().map((placement) => {
              const member = referralSystem.users.find(
                (user) => user.id === placement.userId
              );
              const parent = placement.parentId
                ? referralSystem.users.find((user) => user.id === placement.parentId)
                : null;

              return (
                <AuditRow
                  key={placement.id}
                  title={member?.name ?? "Unknown member"}
                  meta={`Parent: ${parent?.name ?? "Root"} - Position: ${
                    placement.position ?? "Root"
                  } - Level: ${placement.level}`}
                  status={placement.treeId}
                />
              );
            })}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tree Preview</Text>
              <Text style={styles.memberCount}>{treeMembers.length} members</Text>
            </View>
            <ReferralTree data={mockReferralTree} />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function AuditRow({
  meta,
  onPay,
  onRestore,
  onVoid,
  status,
  title,
}: {
  meta: string;
  onPay?: () => void;
  onRestore?: () => void;
  onVoid?: () => void;
  status: string;
  title: string;
}) {
  return (
    <View style={styles.auditRow}>
      <View style={styles.auditIcon}>
        <FontAwesome6 name="receipt" size={12} color="#C23122" />
      </View>
      <View style={styles.auditCopy}>
        <Text style={styles.auditTitle}>{title}</Text>
        <Text style={styles.auditMeta}>{meta}</Text>
      </View>
      <View style={styles.auditControls}>
        <Text style={styles.auditStatus}>{status}</Text>
        {onPay && status !== "PAID" ? (
          <Pressable onPress={onPay} style={styles.auditButton}>
            <Text style={styles.auditButtonText}>Pay</Text>
          </Pressable>
        ) : null}
        {onVoid && status !== "VOID" ? (
          <Pressable onPress={onVoid} style={styles.auditButton}>
            <Text style={styles.auditButtonText}>Void</Text>
          </Pressable>
        ) : null}
        {onRestore && status !== "AVAILABLE" ? (
          <Pressable onPress={onRestore} style={styles.auditButton}>
            <Text style={styles.auditButtonText}>Restore</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF8F2",
    flex: 1,
  },

  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },

  headerButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },

  headerCopy: {
    flex: 1,
  },

  headerTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 21,
  },

  headerSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 2,
  },

  scrollContent: {
    paddingBottom: 34,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 78,
    padding: 12,
  },

  metricLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  metricValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 19,
    marginTop: 7,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },

  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  statusPill: {
    backgroundColor: "#EAF5EE",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  statusPillText: {
    color: "#2C7447",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  dangerPill: {
    backgroundColor: "#FFF1EF",
  },

  dangerPillText: {
    color: "#C23122",
  },

  capacityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },

  capacityValue: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 24,
  },

  capacityLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  capacityNote: {
    color: "#314640",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 16,
  },

  progressTrack: {
    backgroundColor: "#F1E8E4",
    borderRadius: 6,
    flexDirection: "row",
    height: 10,
    marginTop: 13,
    overflow: "hidden",
  },

  progressFill: {
    backgroundColor: "#C23122",
    height: "100%",
  },

  searchBox: {
    alignItems: "center",
    backgroundColor: "#FFF8F2",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
    paddingHorizontal: 12,
  },

  searchInput: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    minHeight: 42,
  },

  memberPanel: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 14,
  },

  memberAvatar: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  memberAvatarText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  memberInfo: {
    flex: 1,
    marginLeft: 11,
  },

  memberName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  memberMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 2,
  },

  infoRow: {
    alignItems: "center",
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 38,
  },

  infoLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
  },

  infoValue: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 11,
    marginLeft: 10,
    textAlign: "right",
  },

  controlRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  actionButton: {
    alignItems: "center",
    backgroundColor: "#FFF8F2",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },

  activeActionButton: {
    backgroundColor: "#2C7447",
    borderColor: "#2C7447",
  },

  dangerActionButton: {
    backgroundColor: "#C23122",
    borderColor: "#C23122",
  },

  actionButtonText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  activeActionButtonText: {
    color: "#FFFFFF",
  },

  pressed: {
    opacity: 0.72,
  },

  actionStack: {
    gap: 9,
  },

  wideAction: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 8,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 42,
  },

  wideActionText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  secondaryWideAction: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 42,
  },

  secondaryWideActionText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  auditIssue: {
    color: "#C23122",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 9,
  },

  auditClear: {
    color: "#2C7447",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 10,
  },

  productRow: {
    alignItems: "center",
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
  },

  productName: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  productMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  productAmounts: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  productPrice: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  productCommission: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  auditRow: {
    alignItems: "center",
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 58,
  },

  auditIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },

  auditCopy: {
    flex: 1,
    marginLeft: 10,
  },

  auditTitle: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  auditMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  auditStatus: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  auditControls: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 8,
  },

  auditButton: {
    backgroundColor: "#FFF1EF",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  auditButtonText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 8,
  },

  memberCount: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },
});
