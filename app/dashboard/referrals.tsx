import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { getConnectionDetails } from "@/components/accountFeatureData";
import {
  getReferralTotal,
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  mockReferralLink,
  mockReferralTree,
  referralSystem,
} from "@/components/referralData";
import type { ReferralNodeData } from "@/components/referralData";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const inviteCode = "25874123";
const CURRENT_USER_ID = "user-1";
const WIDE_BREAKPOINT = 720;
const INITIAL_EARNINGS_ROWS = 8;

const topInvites = [
  { id: "1", name: "Aisha", earns: 420, rank: 2, color: "#3A8B5D" },
  { id: "2", name: "Rupali", earns: 520, rank: 1, color: "#D7B126" },
  { id: "3", name: "Sandy", earns: 180, rank: 3, color: "#192536" },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type VisibleNode = {
  node: ReferralNodeData;
  children: VisibleNode[];
};

type NetworkTab = "all" | "owned";

type NetworkFilters = {
  level: number | null;
  qualification: string | null;
  status: string | null;
};

const EMPTY_FILTERS: NetworkFilters = {
  level: null,
  qualification: null,
  status: null,
};

const formatGhs = (value: number) => `GH₵${value.toLocaleString("en-GH")}`;
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const levelLabel = (level: number) => (level === 0 ? "Root" : `Level ${level}`);
const isActiveStatus = (status: unknown) => normalize(status) === "active";

function flattenTree(node: ReferralNodeData): ReferralNodeData[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

function flattenVisible(node: VisibleNode): VisibleNode[] {
  return [node, ...node.children.flatMap(flattenVisible)];
}

/**
 * Keeps every node that matches, plus the ancestors needed to keep the
 * hierarchy intact. The original node is retained so counts and
 * "people referred" stay accurate even when children are filtered out.
 */
function pruneTree(
  node: ReferralNodeData,
  predicate: (node: ReferralNodeData) => boolean
): VisibleNode | null {
  const children = node.children
    .map((child) => pruneTree(child, predicate))
    .filter((child): child is VisibleNode => child !== null);

  if (!predicate(node) && children.length === 0) {
    return null;
  }

  return { children, node };
}

/*
 * Commission records are read defensively: only fields that actually exist on
 * the record are used, so nothing is invented. Adjust the key lists if your
 * commission model uses different field names.
 */
const DATE_KEYS = ["createdAt", "date", "earnedAt", "paidAt"];
const SOURCE_KEYS = [
  "sourceUserId",
  "sourceId",
  "fromUserId",
  "referredUserId",
  "memberId",
];
const TYPE_KEYS = ["type", "kind", "commissionType"];
const LEVEL_KEYS = ["level", "treeLevel"];
const STATUS_KEYS = ["status", "paymentStatus"];

function readField(record: object, keys: string[]): string | number | undefined {
  const source = record as Record<string, unknown>;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

function getTimestamp(record: object): number | null {
  const raw = readField(record, DATE_KEYS);

  if (raw === undefined) {
    return null;
  }

  const time = new Date(raw).getTime();

  return Number.isNaN(time) ? null : time;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Small presentational components                                            */
/* -------------------------------------------------------------------------- */

type ChipGroupProps<T extends string | number> = {
  label: string;
  onSelect: (value: T | null) => void;
  options: { label: string; value: T }[];
  selected: T | null;
};

function ChipGroup<T extends string | number>({
  label,
  onSelect,
  options,
  selected,
}: ChipGroupProps<T>) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipGroupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selected === null }}
          onPress={() => onSelect(null)}
          style={[styles.chip, selected === null && styles.chipSelected]}
        >
          <Text
            style={[styles.chipText, selected === null && styles.chipTextSelected]}
          >
            All
          </Text>
        </Pressable>

        {options.map((option) => {
          const isSelected = selected === option.value;

          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(isSelected ? null : option.value)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ReferralOutlineNodeProps = {
  expandedIds: Set<string>;
  isRoot?: boolean;
  item: VisibleNode;
  onToggle: (id: string) => void;
  selectedId: string | null;
};

function ReferralOutlineNode({
  expandedIds,
  isRoot,
  item,
  onToggle,
  selectedId,
}: ReferralOutlineNodeProps) {
  const { node, children } = item;
  const isOpen = selectedId === node.id;
  const showChildren = expandedIds.has(node.id) && children.length > 0;
  const connection = isOpen ? getConnectionDetails(node.id) : null;
  const active = isActiveStatus(node.status);

  const points = isOpen
    ? referralSystem.points
        .filter((point) => point.userId === node.id)
        .reduce((total, point) => total + point.points, 0)
    : 0;
  const earnings = isOpen
    ? referralSystem.commissions
        .filter((commission) => commission.recipientId === node.id)
        .reduce((total, commission) => total + commission.amount, 0)
    : 0;

  const meta = `${isRoot ? "Root account" : levelLabel(node.treeLevel)} • ${
    node.children.length
  } direct referral${node.children.length === 1 ? "" : "s"}`;

  return (
    <View style={styles.outlineNode}>
      <Pressable
        accessibilityHint={isOpen ? "Hides referral details" : "Shows referral details"}
        accessibilityLabel={`${node.name}. ${meta}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => onToggle(node.id)}
        style={({ pressed }) => [
          styles.outlineRow,
          isOpen && styles.selectedOutlineRow,
          isOpen && styles.outlineRowOpen,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.outlineChevron}>
          <FontAwesome6
            name={isOpen ? "chevron-down" : "chevron-right"}
            size={11}
            color={isOpen ? "#192536" : "#8B7F7A"}
          />
        </View>

        <View style={styles.outlineAvatar}>
          <Text style={styles.outlineAvatarText}>{node.name.charAt(0)}</Text>
        </View>

        <View style={styles.outlineCopy}>
          <Text numberOfLines={1} style={styles.outlineName}>
            {node.name}
          </Text>
          <Text numberOfLines={1} style={styles.outlineMeta}>
            {meta}
          </Text>
        </View>

        <View style={[styles.statusPill, active && styles.statusPillActive]}>
          <Text
            style={[styles.statusPillText, active && styles.statusPillTextActive]}
          >
            {String(node.status).toUpperCase()}
          </Text>
        </View>
      </Pressable>

      {isOpen && connection ? (
        <View style={styles.inlineDetailCard}>
          <View style={styles.inlineDetailHeader}>
            <View>
              <Text style={styles.inlineDetailTitle}>Referral Details</Text>
              <Text style={styles.inlineDetailSubtitle}>
                Read-only authorized view
              </Text>
            </View>
            <View style={styles.readOnlyPill}>
              <Text style={styles.readOnlyPillText}>READ ONLY</Text>
            </View>
          </View>

          <View style={styles.inlineDetailGrid}>
            {[
              { label: "Account status", value: String(node.status) },
              {
                label: "Date joined",
                value: new Date(node.createdAt).toLocaleDateString(),
              },
              { label: "People referred", value: String(node.children.length) },
              { label: "Referral level", value: levelLabel(node.treeLevel) },
              { label: "Points", value: points.toLocaleString() },
              {
                label: "Earnings",
                value: `${connection.commissions.length} records • ${formatGhs(
                  earnings
                )}`,
              },
              {
                label: "Qualifying activity",
                value: String(node.qualificationStatus),
              },
              { label: "Referral code", value: node.referralCode },
            ].map((tile) => (
              <View key={tile.label} style={styles.inlineDetailTile}>
                <Text style={styles.detailLabel}>{tile.label}</Text>
                <Text style={styles.detailValue}>{tile.value}</Text>
              </View>
            ))}
          </View>

          {node.children.length ? (
            <View style={styles.childSummary}>
              <Text style={styles.childSummaryTitle}>
                People {node.name} referred
              </Text>
              <Text style={styles.childSummaryText}>
                {node.children.map((child) => child.name).join(" • ")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showChildren ? (
        <View style={styles.outlineChildren}>
          {children.map((child) => (
            <ReferralOutlineNode
              key={child.node.id}
              expandedIds={expandedIds}
              item={child}
              onToggle={onToggle}
              selectedId={selectedId}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function MyReferrals() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [hasCopiedInviteCode, setHasCopiedInviteCode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Network state
  const [tab, setTab] = useState<NetworkTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<NetworkFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set([CURRENT_USER_ID])
  );

  // Earnings state
  const [showEarningsDetails, setShowEarningsDetails] = useState(false);
  const [showAllEarnings, setShowAllEarnings] = useState(false);

  /* ----------------------------- Derived data ----------------------------- */

  const summary = useMemo(
    () => getMemberDashboardSummary(referralSystem, CURRENT_USER_ID),
    []
  );
  const directReferralMembers = useMemo(
    () => getMemberDirectReferrals(referralSystem, CURRENT_USER_ID),
    []
  );
  const ownedIds = useMemo(
    () => new Set(directReferralMembers.map((member) => member.id)),
    [directReferralMembers]
  );
  const totalReferrals = useMemo(() => getReferralTotal(mockReferralTree), []);
  const allNodes = useMemo(() => flattenTree(mockReferralTree), []);
  const activeCount = useMemo(
    () => allNodes.filter((node) => isActiveStatus(node.status)).length,
    [allNodes]
  );

  const lifetimeEarnings = summary.earnings.total;
  const availableBalance = summary.earnings.available;
  const bonusTarget = 600;
  const progress = Math.min(totalReferrals / bonusTarget, 1);

  // Filter options come from the data itself, so only supported values appear.
  const filterOptions = useMemo(() => {
    const unique = <T extends string | number>(values: T[]) =>
      Array.from(new Set(values));

    return {
      levels: unique(allNodes.map((node) => node.treeLevel))
        .sort((a, b) => a - b)
        .map((level) => ({ label: levelLabel(level), value: level })),
      qualifications: unique(
        allNodes.map((node) => normalize(node.qualificationStatus))
      )
        .filter(Boolean)
        .map((value) => ({
          label: value.charAt(0).toUpperCase() + value.slice(1),
          value,
        })),
      statuses: unique(allNodes.map((node) => normalize(node.status)))
        .filter(Boolean)
        .map((value) => ({
          label: value.charAt(0).toUpperCase() + value.slice(1),
          value,
        })),
    };
  }, [allNodes]);

  const activeFilterCount = [
    filters.level !== null,
    filters.qualification !== null,
    filters.status !== null,
  ].filter(Boolean).length;

  const isFiltering =
    query.length > 0 || activeFilterCount > 0 || tab === "owned";

  // Debounce search typing.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(searchInput.trim().toLowerCase());
    }, 200);

    return () => clearTimeout(handle);
  }, [searchInput]);

  const visibleTree = useMemo(() => {
    const predicate = (node: ReferralNodeData) => {
      if (tab === "owned" && !ownedIds.has(node.id)) return false;
      if (filters.status && normalize(node.status) !== filters.status) return false;
      if (
        filters.qualification &&
        normalize(node.qualificationStatus) !== filters.qualification
      ) {
        return false;
      }
      if (filters.level !== null && node.treeLevel !== filters.level) return false;

      if (query) {
        return [node.name, node.referralCode].some((field) =>
          normalize(field).includes(query)
        );
      }

      return true;
    };

    return pruneTree(mockReferralTree, predicate);
  }, [filters, ownedIds, query, tab]);

  const visibleIds = useMemo(
    () =>
      new Set(visibleTree ? flattenVisible(visibleTree).map((v) => v.node.id) : []),
    [visibleTree]
  );

  // Open the branches that lead to matches whenever search/filters change.
  useEffect(() => {
    if (!isFiltering || !visibleTree) return;

    const branchIds = flattenVisible(visibleTree)
      .filter((item) => item.children.length > 0)
      .map((item) => item.node.id);

    setExpandedIds((current) => new Set([...current, ...branchIds]));
  }, [isFiltering, visibleTree]);

  // Drop a stale open panel if its member is no longer visible.
  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleIds]);

  /* ------------------------------- Earnings ------------------------------- */

  const myCommissions = useMemo(
    () =>
      referralSystem.commissions.filter(
        (commission) => commission.recipientId === CURRENT_USER_ID
      ),
    []
  );

  const hasDatedEarnings = useMemo(
    () => myCommissions.some((commission) => getTimestamp(commission) !== null),
    [myCommissions]
  );

  const earningsSince = (days: number) => {
    const cutoff = Date.now() - days * DAY_MS;

    return myCommissions.reduce((total, commission) => {
      const time = getTimestamp(commission);

      return time !== null && time >= cutoff ? total + commission.amount : total;
    }, 0);
  };

  const earningsPeriods = hasDatedEarnings
    ? [
        { label: "Last 7 days", value: earningsSince(7) },
        { label: "Last 30 days", value: earningsSince(30) },
        { label: "Last 6 months", value: earningsSince(183) },
      ]
    : [];

  const sortedCommissions = useMemo(
    () =>
      [...myCommissions].sort(
        (a, b) => (getTimestamp(b) ?? 0) - (getTimestamp(a) ?? 0)
      ),
    [myCommissions]
  );
  const shownCommissions = showAllEarnings
    ? sortedCommissions
    : sortedCommissions.slice(0, INITIAL_EARNINGS_ROWS);

  /* ------------------------------- Handlers ------------------------------- */

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

  /**
   * INTEGRATION POINT: connect this to the real withdrawal flow
   * (route, modal or payout API). Nothing is submitted here and no success
   * state is faked.
   */
  const requestWithdrawal = () => {
    Alert.alert(
      "Withdrawals aren't connected yet",
      `Your available balance is ${formatGhs(
        availableBalance
      )}. Withdrawal will be available once the payout service is connected.`
    );
  };

  const toggleMember = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (selectedId === id) {
      setSelectedId(null);
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setSelectedId(id);
    setExpandedIds((current) => new Set(current).add(id));
  };

  const resetNetworkControls = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput("");
    setQuery("");
  };

  const toggleEarningsDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEarningsDetails((current) => !current);
  };

  /* -------------------------------- Render -------------------------------- */

  const metrics = [
    {
      caption: "Total members in your network",
      icon: "sitemap",
      key: "tree",
      label: "Tree Members",
      value: String(summary.treeSize),
    },
    {
      caption: "People you referred directly",
      icon: "user-plus",
      key: "direct",
      label: "Direct Referrals",
      value: String(summary.directReferrals),
    },
    {
      caption: "Currently active members",
      icon: "user-check",
      key: "active",
      label: "Active Members",
      value: String(activeCount),
    },
    {
      caption: "Total earnings to date",
      icon: "crown",
      key: "earnings",
      label: "Lifetime Earnings",
      value: formatGhs(lifetimeEarnings),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerMenuSlot} />

          <Text style={styles.headerTitle}>Referral</Text>

          <TouchableOpacity
            accessibilityLabel="How referrals work"
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => setShowHelp((current) => !current)}
            style={[styles.headerButton, showHelp && styles.activeHeaderButton]}
          >
            <FontAwesome6
              name="question"
              size={13}
              color={showHelp ? "#FFFFFF" : "#261D1A"}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {showHelp ? (
            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>How referrals work</Text>
              <Text style={styles.helpText}>
                Referral links set the sponsor. The placement engine then fills
                four positions per member from left to right until the tree
                reaches {summary.treeCapacity} members.
              </Text>
            </View>
          ) : null}

          {/* ---------------------------- Summary ---------------------------- */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryHeaderIcon}>
                <FontAwesome6 name="chart-line" size={15} color="#192536" />
              </View>

              <View style={styles.summaryHeaderCopy}>
                <Text style={styles.sectionEyebrow}>REFERRAL SUMMARY</Text>
                <Text style={styles.summaryTitle}>Your referral performance</Text>
              </View>
            </View>

            <View style={[styles.metricsWrap, isWide && styles.metricsWrapWide]}>
              {metrics.map((metric, index) => (
                <View
                  key={metric.key}
                  style={[styles.metricGroup, isWide && styles.metricGroupWide]}
                >
                  <View style={[styles.metricTile, isWide && styles.metricTileWide]}>
                    <View
                      style={[
                        styles.metricIcon,
                        metric.key === "earnings" && styles.metricIconAccent,
                      ]}
                    >
                      <FontAwesome6
                        name={metric.icon}
                        size={14}
                        color={metric.key === "earnings" ? "#FFFFFF" : "#192536"}
                      />
                    </View>
                    <Text style={styles.metricTileLabel}>{metric.label}</Text>
                    <Text numberOfLines={1} style={styles.metricTileValue}>
                      {metric.value}
                    </Text>
                    <Text style={styles.metricTileCaption}>{metric.caption}</Text>
                  </View>

                  {isWide && index < metrics.length - 1 ? (
                    <View style={styles.flowArrow}>
                      <FontAwesome6 name="chevron-right" size={11} color="#D8C7C1" />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            <Text style={styles.flowCaption}>
              Network growth → direct referrals → active members → earnings
            </Text>

            <View style={styles.summaryMetaRow}>
              <Text style={styles.summaryMeta}>
                Direct placement{" "}
                <Text style={styles.summaryMetaStrong}>
                  {summary.directPlacements}/4
                </Text>
              </Text>
              <Text style={styles.summaryMeta}>
                Open spaces{" "}
                <Text style={styles.summaryMetaStrong}>
                  {summary.availableTreeSpaces}
                </Text>
              </Text>
              <Text style={styles.summaryMeta}>
                Status{" "}
                <Text style={styles.summaryMetaStrong}>{summary.treeStatus}</Text>
              </Text>
            </View>

            <View style={styles.shareSection}>
              <View style={styles.shareSectionHeader}>
                <View style={styles.shareSectionIcon}>
                  <FontAwesome6 name="user-plus" size={14} color="#192536" />
                </View>

                <View style={styles.shareSectionCopy}>
                  <Text style={styles.shareSectionTitle}>Share & Earn</Text>
                  <Text style={styles.shareSectionSubtitle}>
                    Invite friends using your referral code
                  </Text>
                </View>
              </View>

              <View style={styles.codeCard}>
                <View style={styles.codeInfo}>
                  <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
                  <Text style={styles.codeValue}>{inviteCode}</Text>
                </View>

                <Pressable
                  accessibilityLabel="Copy invite code"
                  onPress={copyInviteCode}
                  style={({ pressed }) => [
                    styles.copyButton,
                    hasCopiedInviteCode && styles.copyButtonSuccess,
                    pressed && styles.pressed,
                  ]}
                >
                  <FontAwesome6
                    name={hasCopiedInviteCode ? "check" : "copy"}
                    size={14}
                    color={hasCopiedInviteCode ? "#FFFFFF" : "#314640"}
                  />
                </Pressable>
              </View>

              {hasCopiedInviteCode ? (
                <View style={styles.copyFeedbackRow}>
                  <FontAwesome6 name="circle-check" size={11} color="#3A8B5D" />
                  <Text style={styles.copyFeedback}>
                    Referral code copied successfully
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share referral invitation"
                onPress={shareInvite}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shareButtonIcon}>
                  <FontAwesome6
                    name="share-nodes"
                    size={13}
                    color="#192536"
                  />
                </View>
                <Text style={styles.shareButtonText}>Share Referral Link</Text>
                <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* ---------------------------- Earnings --------------------------- */}
          <View style={styles.earningCard}>
            <View style={styles.earningHeader}>
              <View style={styles.rewardIcon}>
                <FontAwesome6 name="wallet" size={15} color="#192536" />
              </View>

              <Text style={styles.earningTitle}>Referral Earnings</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showEarningsDetails }}
                onPress={toggleEarningsDetails}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {showEarningsDetails ? "Hide Details" : "View Details"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.balanceRow}>
              <View style={styles.balanceBlock}>
                <Text style={styles.balanceLabel}>Lifetime earnings</Text>
                <Text style={styles.balanceValue}>{formatGhs(lifetimeEarnings)}</Text>
              </View>

              <View style={[styles.balanceBlock, styles.balanceBlockRight]}>
                <Text style={styles.balanceLabel}>Available to withdraw</Text>
                <Text style={styles.availableValue}>
                  {formatGhs(availableBalance)}
                </Text>
              </View>
            </View>

            {earningsPeriods.length ? (
              <View style={styles.periodRow}>
                {earningsPeriods.map((period, index) => (
                  <View
                    key={period.label}
                    style={[styles.periodItem, index > 0 && styles.periodItemBorder]}
                  >
                    <Text style={styles.periodLabel}>{period.label}</Text>
                    <Text style={styles.periodValue}>{formatGhs(period.value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Withdraw earnings"
              accessibilityRole="button"
              accessibilityState={{ disabled: availableBalance <= 0 }}
              disabled={availableBalance <= 0}
              onPress={requestWithdrawal}
              style={({ pressed }) => [
                styles.withdrawButton,
                availableBalance <= 0 && styles.withdrawButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <FontAwesome6 name="money-bill-transfer" size={14} color="#FFFFFF" />
              <Text style={styles.withdrawButtonText}>Withdraw Earnings</Text>
            </Pressable>

            {showEarningsDetails ? (
              <View style={styles.earningsDetails}>
                {sortedCommissions.length === 0 ? (
                  <Text style={styles.emptyInline}>No referral earnings yet</Text>
                ) : (
                  <>
                    {shownCommissions.map((commission, index) => {
                      const time = getTimestamp(commission);
                      const sourceId = readField(commission, SOURCE_KEYS);
                      const source = referralSystem.users.find(
                        (user) => user.id === sourceId
                      );
                      const type = readField(commission, TYPE_KEYS);
                      const level = readField(commission, LEVEL_KEYS);
                      const status = readField(commission, STATUS_KEYS);
                      const subtitle = [
                        time !== null ? new Date(time).toLocaleDateString() : null,
                        level !== undefined
                          ? typeof level === "number"
                            ? levelLabel(level)
                            : String(level)
                          : null,
                        type !== undefined ? String(type) : null,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <View
                          key={String(readField(commission, ["id"]) ?? index)}
                          style={styles.earningsRow}
                        >
                          <View style={styles.earningsRowCopy}>
                            <Text numberOfLines={1} style={styles.earningsRowTitle}>
                              {source?.name ?? "Referral commission"}
                            </Text>
                            {subtitle ? (
                              <Text numberOfLines={1} style={styles.earningsRowMeta}>
                                {subtitle}
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.earningsRowRight}>
                            <Text style={styles.earningsRowAmount}>
                              {formatGhs(commission.amount)}
                            </Text>
                            {status !== undefined ? (
                              <Text style={styles.earningsRowStatus}>
                                {String(status).toUpperCase()}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}

                    {sortedCommissions.length > INITIAL_EARNINGS_ROWS ? (
                      <Pressable
                        onPress={() => setShowAllEarnings((current) => !current)}
                        style={styles.showMoreButton}
                      >
                        <Text style={styles.showMoreText}>
                          {showAllEarnings
                            ? "Show fewer"
                            : `Show all ${sortedCommissions.length}`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            <View style={styles.bonusBlock}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { flex: progress }]} />
                <View style={{ flex: 1 - progress }} />
                <View style={styles.progressGift}>
                  <FontAwesome6 name="gift" size={8} color="#192536" />
                </View>
              </View>

              <Text style={styles.progressText}>
                {totalReferrals} of {bonusTarget} referrals toward the bonus draw
              </Text>
            </View>
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
                  <Text style={styles.avatarInitial}>{invite.name.charAt(0)}</Text>
                  <View style={[styles.rankBadge, { backgroundColor: invite.color }]}>
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
            {directReferralMembers.slice(0, 6).map((friend, index) => (
              <View key={friend.id} style={styles.friendRow}>
                <Text style={styles.friendRank}>{index + 1}</Text>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitial}>{friend.name.charAt(0)}</Text>
                </View>
                <View style={styles.friendCopy}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendMeta}>
                    Parent -{" "}
                    {referralSystem.users.find(
                      (user) => user.id === friend.placementParentId
                    )?.name ?? "None"}
                  </Text>
                </View>
                <View style={styles.friendEarns}>
                  <Text style={styles.friendEarnLabel}>Position</Text>
                  <View style={styles.coinLine}>
                    <View style={styles.smallCoin}>
                      <FontAwesome6 name="sitemap" size={7} color="#FFFFFF" />
                    </View>
                    <Text style={styles.friendEarnValue}>
                      {friend.placementPosition}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* ------------------------ Referral Network ------------------------ */}
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <View>
                <Text style={styles.levelTitle}>Referral Network</Text>
                <Text style={styles.levelSubtitle}>
                  Tap any row to view authorized details and its referrals.
                </Text>
              </View>

              <View style={styles.readOnlyPill}>
                <Text style={styles.readOnlyPillText}>READ ONLY</Text>
              </View>
            </View>

            <View style={styles.networkControls}>
              {(
                [
                  { count: totalReferrals, key: "all", label: "All" },
                  { count: ownedIds.size, key: "owned", label: "Owned by me" },
                ] as const
              ).map((item) => {
                const isActive = tab === item.key;

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => setTab(item.key)}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isActive && styles.filterPillActiveText,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.filterPillCount,
                        isActive && styles.filterPillActiveCount,
                      ]}
                    >
                      {item.count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <FontAwesome6 name="magnifying-glass" size={11} color="#8B7F7A" />
                <TextInput
                  accessibilityLabel="Search referral network"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setSearchInput}
                  placeholder="Search name or referral code"
                  placeholderTextColor="#B5AAA5"
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={searchInput}
                />
                {searchInput ? (
                  <Pressable
                    accessibilityLabel="Clear search"
                    hitSlop={8}
                    onPress={() => {
                      setSearchInput("");
                      setQuery("");
                    }}
                  >
                    <FontAwesome6 name="circle-xmark" size={13} color="#B5AAA5" />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                accessibilityLabel="Filter referral network"
                accessibilityRole="button"
                accessibilityState={{ expanded: showFilters }}
                onPress={() => setShowFilters((current) => !current)}
                style={[
                  styles.filterButton,
                  (showFilters || activeFilterCount > 0) && styles.filterButtonActive,
                ]}
              >
                <FontAwesome6
                  name="filter"
                  size={11}
                  color={showFilters || activeFilterCount > 0 ? "#192536" : "#8B7F7A"}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    (showFilters || activeFilterCount > 0) &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </Text>
              </Pressable>
            </View>

            {showFilters ? (
              <View style={styles.filterPanel}>
                <ChipGroup
                  label="Status"
                  onSelect={(value) =>
                    setFilters((current) => ({ ...current, status: value }))
                  }
                  options={filterOptions.statuses}
                  selected={filters.status}
                />
                <ChipGroup
                  label="Qualification"
                  onSelect={(value) =>
                    setFilters((current) => ({ ...current, qualification: value }))
                  }
                  options={filterOptions.qualifications}
                  selected={filters.qualification}
                />
                <ChipGroup
                  label="Level"
                  onSelect={(value) =>
                    setFilters((current) => ({ ...current, level: value }))
                  }
                  options={filterOptions.levels}
                  selected={filters.level}
                />

                <Pressable
                  disabled={activeFilterCount === 0}
                  onPress={() => setFilters(EMPTY_FILTERS)}
                  style={styles.clearFilters}
                >
                  <Text
                    style={[
                      styles.clearFiltersText,
                      activeFilterCount === 0 && styles.clearFiltersTextDisabled,
                    ]}
                  >
                    Clear Filters
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.networkOutline}>
              {visibleTree ? (
                <ReferralOutlineNode
                  expandedIds={expandedIds}
                  isRoot
                  item={visibleTree}
                  onToggle={toggleMember}
                  selectedId={selectedId}
                />
              ) : (
                <View style={styles.emptyState}>
                  <FontAwesome6 name="user-slash" size={20} color="#B5AAA5" />
                  <Text style={styles.emptyTitle}>No members found</Text>
                  <Text style={styles.emptyText}>
                    Try searching by name or referral code.
                  </Text>
                  {isFiltering ? (
                    <Pressable onPress={resetNetworkControls} style={styles.clearFilters}>
                      <Text style={styles.clearFiltersText}>Reset search & filters</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>

            <Text style={styles.detailNote}>
              Users can explore only the referral network returned by the backend.
              This page does not expose editing controls for referral relationships,
              points, earnings, or payment records.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
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

  headerMenuSlot: {
    height: 44,
    width: 44,
  },

  activeHeaderButton: {
    backgroundColor: "#192536",
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

  /* Summary */
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#EEDBD5",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
    padding: 16,
    shadowColor: "#3B2119",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },

  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 16,
  },

  summaryHeaderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    marginRight: 10,
    width: 38,
  },

  summaryHeaderCopy: {
    flex: 1,
  },

  sectionEyebrow: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 9,
    letterSpacing: 1.2,
  },

  summaryTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 15,
    marginTop: 1,
  },

  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  metricsWrapWide: {
    flexWrap: "nowrap",
    gap: 0,
  },

  metricGroup: {
    flexBasis: "47%",
    flexGrow: 1,
  },

  metricGroupWide: {
    alignItems: "center",
    flexBasis: 0,
    flexDirection: "row",
  },

  metricTile: {
    backgroundColor: "#FFF9F5",
    borderColor: "#F4E6E1",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 118,
    padding: 12,
  },

  metricTileWide: {
    minHeight: 124,
  },

  metricIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  metricIconAccent: {
    backgroundColor: "#192536",
  },

  metricTileLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 9,
  },

  metricTileValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 19,
    marginTop: 2,
  },

  metricTileCaption: {
    color: "#A09590",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
    lineHeight: 12,
    marginTop: 2,
  },

  flowArrow: {
    alignItems: "center",
    justifyContent: "center",
    width: 18,
  },

  flowCaption: {
    color: "#9A8E89",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 12,
    textAlign: "center",
  },

  summaryMetaRow: {
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    columnGap: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 11,
    rowGap: 4,
  },

  summaryMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
  },

  summaryMetaStrong: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
  },

  /* Share & Earn */
  shareSection: {
    backgroundColor: "#FFF9F5",
    borderColor: "#F1DDD7",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 13,
  },

  shareSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },

  shareSectionIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    marginRight: 10,
    width: 36,
  },

  shareSectionCopy: {
    flex: 1,
  },

  shareSectionTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  shareSectionSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 1,
  },

  codeInfo: {
    flex: 1,
  },

  copyButtonSuccess: {
    backgroundColor: "#3A8B5D",
  },

  copyFeedbackRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 7,
  },

  shareButtonIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    height: 25,
    justifyContent: "center",
    width: 25,
  },

  /* Earnings */
  earningCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16,
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

  secondaryButton: {
    borderColor: "#192536",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  secondaryButtonText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  balanceRow: {
    columnGap: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
    rowGap: 10,
  },

  balanceBlock: {
    flex: 1,
    minWidth: 140,
  },

  balanceBlockRight: {
    alignItems: "flex-start",
  },

  balanceLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
  },

  balanceValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 26,
    marginTop: 2,
  },

  availableValue: {
    color: "#2F7C50",
    fontFamily: "PoppinsBold",
    fontSize: 26,
    marginTop: 2,
  },

  periodRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    flexDirection: "row",
    marginTop: 14,
    paddingVertical: 10,
  },

  periodItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 6,
  },

  periodItemBorder: {
    borderLeftColor: "#F0D6D0",
    borderLeftWidth: 1,
  },

  periodLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
  },

  periodValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginTop: 2,
  },

  withdrawButton: {
    alignItems: "center",
    backgroundColor: "#192536",
    borderRadius: 12,
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
  },

  withdrawButtonDisabled: {
    backgroundColor: "#D9C9C4",
  },

  withdrawButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  earningsDetails: {
    borderTopColor: "#F1E8E4",
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 4,
  },

  earningsRow: {
    alignItems: "center",
    borderBottomColor: "#F6EEEA",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingVertical: 8,
  },

  earningsRowCopy: {
    flex: 1,
    minWidth: 0,
  },

  earningsRowTitle: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  earningsRowMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  earningsRowRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },

  earningsRowAmount: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  earningsRowStatus: {
    color: "#2F7C50",
    fontFamily: "PoppinsBold",
    fontSize: 8,
    marginTop: 2,
  },

  showMoreButton: {
    alignItems: "center",
    paddingVertical: 10,
  },

  showMoreText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  emptyInline: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    paddingVertical: 14,
    textAlign: "center",
  },

  bonusBlock: {
    marginTop: 16,
  },

  coinLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
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
    overflow: "hidden",
  },

  progressFill: {
    backgroundColor: "#192536",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },

  heroCopy: {
    alignItems: "center",
    marginBottom: 20,
  },

  heroTitle: {
    color: "#192536",
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

  shareLabel: {
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 16,
    marginBottom: 10,
  },

  codeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#192536",
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
    backgroundColor: "#192536",
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
    backgroundColor: "#192536",
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
    backgroundColor: "#FFFFFF",
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
    color: "#192536",
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

  /* Referral network */
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

  levelSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
    maxWidth: 220,
  },

  readOnlyPill: {
    alignItems: "center",
    backgroundColor: "#E9FBF5",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  readOnlyPillText: {
    color: "#2F7C50",
    fontFamily: "PoppinsBold",
    fontSize: 8,
  },

  networkControls: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 12,
  },

  filterPillActive: {
    backgroundColor: "#192536",
    borderColor: "#192536",
  },

  filterPillActiveText: {
    color: "#FFFFFF",
  },

  filterPillActiveCount: {
    color: "#FFE2DD",
  },

  filterPill: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  filterPillText: {
    color: "#6C625F",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  filterPillCount: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  searchBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    columnGap: 8,
    flex: 1,
    flexDirection: "row",
    minHeight: 40,
    paddingHorizontal: 12,
  },

  searchInput: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    paddingVertical: 8,
  },

  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 10,
    borderWidth: 1,
    columnGap: 6,
    flexDirection: "row",
    minHeight: 40,
    paddingHorizontal: 12,
  },

  filterButtonActive: {
    backgroundColor: "#FFF1EF",
    borderColor: "#192536",
  },

  filterButtonText: {
    color: "#6C625F",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  filterButtonTextActive: {
    color: "#192536",
  },

  filterPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },

  chipGroup: {
    marginBottom: 10,
  },

  chipGroupLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 9,
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: "uppercase",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  chip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  chipSelected: {
    backgroundColor: "#192536",
    borderColor: "#192536",
  },

  chipText: {
    color: "#6C625F",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  chipTextSelected: {
    color: "#FFFFFF",
  },

  clearFilters: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },

  clearFiltersText: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  clearFiltersTextDisabled: {
    color: "#C9BDB8",
  },

  networkOutline: {
    backgroundColor: "#FBFDFD",
    borderColor: "#EDF1F0",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: "hidden",
    paddingVertical: 8,
  },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
    rowGap: 6,
  },

  emptyTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
    marginTop: 6,
  },

  emptyText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    textAlign: "center",
  },

  outlineNode: {
    position: "relative",
  },

  outlineRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#EEF2F1",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: 8,
    marginVertical: 4,
    minHeight: 56,
    paddingHorizontal: 8,
  },

  selectedOutlineRow: {
    borderColor: "#192536",
  },

  outlineRowOpen: {
    marginBottom: 0,
  },

  outlineChevron: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 24,
  },

  outlineAvatar: {
    alignItems: "center",
    backgroundColor: "#F2DEB7",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    marginRight: 10,
    width: 32,
  },

  outlineAvatarText: {
    color: "#8A5C13",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    textTransform: "uppercase",
  },

  outlineCopy: {
    flex: 1,
    minWidth: 0,
  },

  outlineName: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  outlineMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 2,
  },

  statusPill: {
    alignItems: "center",
    backgroundColor: "#F2F4F7",
    borderRadius: 8,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  statusPillActive: {
    backgroundColor: "#E9FBF5",
  },

  statusPillText: {
    color: "#6C625F",
    fontFamily: "PoppinsBold",
    fontSize: 8,
  },

  statusPillTextActive: {
    color: "#2F7C50",
  },

  outlineChildren: {
    borderLeftColor: "#E7EFED",
    borderLeftWidth: 1,
    marginLeft: 22,
    paddingLeft: 6,
  },

  inlineDetailCard: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderColor: "#192536",
    borderTopWidth: 0,
    borderWidth: 1,
    marginBottom: 6,
    marginHorizontal: 8,
    padding: 12,
  },

  inlineDetailHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  inlineDetailTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  inlineDetailSubtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    marginTop: 1,
  },

  inlineDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  inlineDetailTile: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F2E6E2",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  childSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: 9,
    padding: 10,
  },

  childSummaryTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  childSummaryText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  detailLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
  },

  detailValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 11,
    marginTop: 4,
  },

  detailNote: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 11,
  },
});
