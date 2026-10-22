import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MAX_DIRECT_PLACEMENT_CHILDREN,
  getReferralInitials,
  referralSystem,
  ReferralNodeData,
} from "./referralData";

type ReferralTreeProps = {
  data: ReferralNodeData;
  compact?: boolean;
};

type ReferralNodeProps = {
  node: ReferralNodeData;
  compact: boolean;
};

function ReferralNode({ node, compact }: ReferralNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const shownChildren = compact ? node.children.slice(0, 4) : node.children;
  const hiddenCount = compact
    ? Math.max(node.children.length - shownChildren.length, 0)
    : 0;
  const sponsor = node.sponsorId
    ? referralSystem.users.find((user) => user.id === node.sponsorId)
    : null;
  const placementParent = node.placementParentId
    ? referralSystem.users.find((user) => user.id === node.placementParentId)
    : null;
  const availablePositions = Math.max(
    MAX_DIRECT_PLACEMENT_CHILDREN - node.children.length,
    0
  );

  return (
    <View style={styles.nodeBranch}>
      <Pressable
        disabled={!hasChildren}
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [
          compact ? styles.compactNodeCard : styles.nodeCard,
          node.treeLevel === 0 && styles.rootNodeCard,
          pressed && hasChildren && styles.pressedNode,
        ]}
      >
        <View
          style={[
            styles.avatar,
            node.treeLevel === 0 && styles.rootAvatar,
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              node.treeLevel === 0 && styles.rootAvatarText,
            ]}
          >
            {getReferralInitials(node.name)}
          </Text>
        </View>

        <Text numberOfLines={1} style={styles.nodeName}>
          {node.name}
        </Text>

        <Text numberOfLines={1} style={styles.nodeCode}>
          {node.referralCode}
        </Text>

        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>
            {node.treeLevel === 0 ? "Root" : `Level ${node.treeLevel}`}
          </Text>
        </View>

        <View style={styles.positionSlots}>
          {Array.from({ length: MAX_DIRECT_PLACEMENT_CHILDREN }, (_, index) => {
            const slot = index + 1;
            const isFilled = node.children.some(
              (child) => child.placementPosition === slot
            );

            return (
              <View
                key={slot}
                style={[styles.slotDot, isFilled && styles.filledSlotDot]}
              />
            );
          })}
        </View>

        {hasChildren ? (
          <View style={styles.childCountRow}>
            <FontAwesome6
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={9}
              color="#192536"
            />

            <Text style={styles.childCountText}>
              {node.children.length}/4 placed
            </Text>
          </View>
        ) : null}

        {!compact ? (
          <View style={styles.nodeMeta}>
            <Text numberOfLines={1} style={styles.nodeMetaText}>
              Sponsor: {sponsor?.name ?? "None"}
            </Text>
            <Text numberOfLines={1} style={styles.nodeMetaText}>
              Parent: {placementParent?.name ?? "None"}
            </Text>
            <Text style={styles.nodeMetaText}>
              Product L{node.productLevel} - {node.qualificationStatus}
            </Text>
            <Text style={styles.nodeMetaText}>
              Open slots: {availablePositions}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {hasChildren && isExpanded ? (
        <View style={styles.childrenWrap}>
          <View style={styles.verticalLine} />

          <View style={styles.childrenRow}>
            {shownChildren.map((child) => (
              <View key={child.id} style={styles.childBranch}>
                <View style={styles.connectorLine} />

                <ReferralNode node={child} compact={compact} />
              </View>
            ))}
          </View>

          {hiddenCount > 0 ? (
            <Text style={styles.hiddenCount}>
              +{hiddenCount} more members
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ReferralTree({
  data,
  compact = false,
}: ReferralTreeProps) {
  const contentMinWidth = useMemo(() => {
    if (compact) {
      return 280;
    }

    return Math.max(760, data.children.length * 116);
  }, [compact, data.children.length]);

  return (
    <ScrollView
      horizontal={!compact}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.treeScrollContent,
        { minWidth: contentMinWidth },
      ]}
    >
      <ReferralNode node={data} compact={compact} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  treeScrollContent: {
    alignItems: "flex-start",
    paddingVertical: 2,
  },

  nodeBranch: {
    alignItems: "center",
  },

  nodeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 194,
    padding: 10,
    width: 148,
  },

  compactNodeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 138,
    padding: 10,
    width: 104,
  },

  rootNodeCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
  },

  pressedNode: {
    opacity: 0.78,
  },

  avatar: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderColor: "#F0D6D0",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  rootAvatar: {
    backgroundColor: "#192536",
    borderColor: "#192536",
  },

  avatarText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  rootAvatarText: {
    color: "#FFFFFF",
  },

  nodeName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginTop: 7,
    maxWidth: 74,
  },

  nodeCode: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
    marginTop: 2,
    maxWidth: 96,
  },

  levelPill: {
    backgroundColor: "#FFF1EF",
    borderRadius: 8,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  levelPillText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 8,
  },

  childCountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },

  childCountText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
  },

  positionSlots: {
    flexDirection: "row",
    gap: 4,
    marginTop: 7,
  },

  slotDot: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E1D2CB",
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    width: 8,
  },

  filledSlotDot: {
    backgroundColor: "#3A8B5D",
    borderColor: "#3A8B5D",
  },

  nodeMeta: {
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 7,
    width: "100%",
  },

  nodeMetaText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
    lineHeight: 13,
  },

  childrenWrap: {
    alignItems: "center",
  },

  verticalLine: {
    backgroundColor: "#E9D9D3",
    height: 18,
    width: 1,
  },

  childrenRow: {
    flexDirection: "row",
    gap: 14,
  },

  childBranch: {
    alignItems: "center",
  },

  connectorLine: {
    backgroundColor: "#E9D9D3",
    height: 1,
    marginBottom: 10,
    width: 44,
  },

  hiddenCount: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 9,
  },
});
