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
  getReferralInitials,
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
  const shownChildren = compact ? node.children.slice(0, 3) : node.children;
  const hiddenCount = compact
    ? Math.max(node.children.length - shownChildren.length, 0)
    : 0;

  return (
    <View style={styles.nodeBranch}>
      <Pressable
        disabled={!hasChildren}
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [
          styles.nodeCard,
          node.level === 0 && styles.rootNodeCard,
          pressed && hasChildren && styles.pressedNode,
        ]}
      >
        <View
          style={[
            styles.avatar,
            node.level === 0 && styles.rootAvatar,
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              node.level === 0 && styles.rootAvatarText,
            ]}
          >
            {getReferralInitials(node.name)}
          </Text>
        </View>

        <Text numberOfLines={1} style={styles.nodeName}>
          {node.name}
        </Text>

        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>
            {node.level === 0 ? "You" : `Level ${node.level}`}
          </Text>
        </View>

        {hasChildren ? (
          <View style={styles.childCountRow}>
            <FontAwesome6
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={9}
              color="#C23122"
            />

            <Text style={styles.childCountText}>
              {node.children.length} {node.children.length === 1 ? "child" : "children"}
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
              +{hiddenCount} more first-level members
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
    minHeight: 116,
    padding: 10,
    width: 92,
  },

  rootNodeCard: {
    backgroundColor: "#FFF8F2",
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
    backgroundColor: "#C23122",
    borderColor: "#C23122",
  },

  avatarText: {
    color: "#C23122",
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

  levelPill: {
    backgroundColor: "#FFF1EF",
    borderRadius: 8,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  levelPillText: {
    color: "#C23122",
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
    gap: 12,
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
