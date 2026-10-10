import {
  AdminSession,
  backendAuthorizationRequirements,
  getAdminSession,
  isAdminRole,
  logoutAdminAccount,
} from "@/components/adminAccess";
import { formatGhs, orders, products } from "@/components/dashboardData";
import {
  getAdminSummary,
  getMemberDirectReferrals,
  getMemberEarnings,
  getPlacementChildren,
  referralSystem,
  validateReferralIntegrity,
} from "@/components/referralData";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type AdminSection =
  | "Dashboard"
  | "Users"
  | "Products"
  | "Orders"
  | "Referrals"
  | "Commissions"
  | "Payments"
  | "Notifications"
  | "Settings";

const adminSections: { label: AdminSection; icon: string }[] = [
  { label: "Dashboard", icon: "chart-line" },
  { label: "Users", icon: "users" },
  { label: "Products", icon: "box-open" },
  { label: "Orders", icon: "receipt" },
  { label: "Referrals", icon: "sitemap" },
  { label: "Commissions", icon: "coins" },
  { label: "Payments", icon: "credit-card" },
  { label: "Notifications", icon: "bell" },
  { label: "Settings", icon: "gear" },
];

const orderRows = [
  ...orders,
  { id: "#AF-1027", status: "Pending", total: "GHS 180" },
  { id: "#AF-1028", status: "Shipped", total: "GHS 520" },
];

const paymentRows = [
  { id: "PAY-001", recipient: "Jennifer", status: "Pending", amount: 240 },
  { id: "PAY-002", recipient: "Aisha Mensah", status: "Paid", amount: 120 },
  { id: "PAY-003", recipient: "Kofi Badu", status: "Pending", amount: 84 },
];

const formatUsd = (amount: number) =>
  `$${amount.toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;

export default function AdminDashboard() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState("");
  const [activeSection, setActiveSection] =
    useState<AdminSection>("Dashboard");
  const [search, setSearch] = useState("");
  const adminSummary = getAdminSummary(referralSystem);
  const integrity = validateReferralIntegrity(referralSystem);

  useEffect(() => {
    const checkAccess = async () => {
      const storedSession = await getAdminSession();

      if (!storedSession) {
        router.replace("/admin/login" as any);
        return;
      }

      if (!isAdminRole(storedSession.role)) {
        setAccessDenied("This authenticated account is not authorized for admin.");
        setIsCheckingAccess(false);
        return;
      }

      setSession(storedSession);
      setIsCheckingAccess(false);
    };

    checkAccess();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return referralSystem.users;
    }

    return referralSystem.users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.referralCode.toLowerCase().includes(normalizedSearch)
    );
  }, [search]);

  const handleLogout = async () => {
    await logoutAdminAccount();
    router.replace("/dashboard" as any);
  };

  const confirmProductDeactivate = (name: string) => {
    Alert.alert(
      "Deactivate product",
      `${name} would be deactivated through the protected backend endpoint.`,
      [{ text: "Cancel" }, { text: "Continue" }]
    );
  };

  if (isCheckingAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>Checking admin access</Text>
          <Text style={styles.centerText}>Verifying session and role...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <FontAwesome6 name="ban" size={32} color="#C23122" />
          <Text style={styles.centerTitle}>Access denied</Text>
          <Text style={styles.centerText}>{accessDenied}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.replace("/dashboard" as any)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Return to app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Admin Dashboard</Text>
            <Text style={styles.title}>Welcome, {session?.name ?? "Admin"}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <FontAwesome6 name="right-from-bracket" size={15} color="#C23122" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navScroll}
        >
          {adminSections.map((item) => {
            const isActive = activeSection === item.label;

            return (
              <Pressable
                key={item.label}
                onPress={() => setActiveSection(item.label)}
                style={({ pressed }) => [
                  styles.navChip,
                  isActive && styles.activeNavChip,
                  pressed && styles.pressed,
                ]}
              >
                <FontAwesome6
                  name={item.icon as any}
                  size={12}
                  color={isActive ? "#FFFFFF" : "#C23122"}
                />
                <Text
                  style={[
                    styles.navChipText,
                    isActive && styles.activeNavChipText,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {activeSection === "Dashboard" ? (
            <DashboardSection adminSummary={adminSummary} />
          ) : null}

          {activeSection === "Users" ? (
            <UsersSection
              search={search}
              setSearch={setSearch}
              users={filteredUsers}
            />
          ) : null}

          {activeSection === "Products" ? (
            <ProductsSection onDeactivate={confirmProductDeactivate} />
          ) : null}

          {activeSection === "Orders" ? <OrdersSection /> : null}
          {activeSection === "Referrals" ? <ReferralsSection /> : null}
          {activeSection === "Commissions" ? <CommissionsSection /> : null}
          {activeSection === "Payments" ? <PaymentsSection /> : null}
          {activeSection === "Notifications" ? <NotificationsSection /> : null}

          {activeSection === "Settings" ? (
            <SettingsSection integrityPassed={integrity.passed} />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function DashboardSection({
  adminSummary,
}: {
  adminSummary: ReturnType<typeof getAdminSummary>;
}) {
  const dashboardCards = [
    { label: "Total Users", value: adminSummary.totalMembers, icon: "users" },
    { label: "Total Products", value: products.length, icon: "box-open" },
    { label: "Total Orders", value: orderRows.length, icon: "receipt" },
    {
      label: "Pending Orders",
      value: orderRows.filter((order) => order.status === "Pending").length,
      icon: "clock",
    },
    {
      label: "Total Referrals",
      value: adminSummary.totalReferrals,
      icon: "sitemap",
    },
    {
      label: "Commissions",
      value: formatUsd(adminSummary.totalCommissions),
      icon: "coins",
    },
    {
      label: "Pending Payments",
      value: paymentRows.filter((payment) => payment.status === "Pending").length,
      icon: "credit-card",
    },
    { label: "Revenue", value: formatGhs(21480), icon: "chart-line" },
  ];

  return (
    <View>
      <View style={styles.summaryGrid}>
        {dashboardCards.map((card) => (
          <View key={card.label} style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <FontAwesome6 name={card.icon as any} size={13} color="#C23122" />
            </View>
            <Text style={styles.summaryLabel}>{card.label}</Text>
            <Text numberOfLines={1} style={styles.summaryValue}>
              {card.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function UsersSection({
  search,
  setSearch,
  users,
}: {
  search: string;
  setSearch: (value: string) => void;
  users: typeof referralSystem.users;
}) {
  return (
    <View>
      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Search users, email, or referral code"
      />
      {users.slice(0, 12).map((user) => {
        const directReferrals = getMemberDirectReferrals(referralSystem, user.id);
        const placementChildren = getPlacementChildren(referralSystem, user.id);
        const earnings = getMemberEarnings(referralSystem, user.id);

        return (
          <View key={user.id} style={styles.listCard}>
            <View style={styles.listTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
              </View>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{user.name}</Text>
                <Text style={styles.listMeta}>{user.email}</Text>
              </View>
              <StatusPill label={user.status} />
            </View>
            <View style={styles.detailGrid}>
              <MiniDetail label="Code" value={user.referralCode} />
              <MiniDetail label="Referrals" value={`${directReferrals.length}`} />
              <MiniDetail label="Placement" value={`${placementChildren.length}/4`} />
              <MiniDetail label="Earnings" value={formatUsd(earnings.total)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProductsSection({
  onDeactivate,
}: {
  onDeactivate: (name: string) => void;
}) {
  return (
    <View>
      <TouchableOpacity activeOpacity={0.85} style={styles.addButton}>
        <FontAwesome6 name="plus" size={12} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add Product</Text>
      </TouchableOpacity>
      {products.map((product, index) => (
        <View key={product.name} style={styles.listCard}>
          <View style={styles.listTop}>
            <View style={[styles.productIcon, { backgroundColor: product.color }]}>
              <FontAwesome6 name={product.icon as any} size={14} color="#FFFFFF" />
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>{product.name}</Text>
              <Text style={styles.listMeta}>
                {product.category} - {product.unit}
              </Text>
            </View>
            <Text style={styles.priceText}>{formatGhs(product.price)}</Text>
          </View>
          <View style={styles.actionRow}>
            <ActionChip label="Edit" icon="pen-to-square" />
            <ActionChip label="Stock" icon="boxes-stacked" />
            <ActionChip
              label={index % 2 === 0 ? "Active" : "Inactive"}
              icon="toggle-on"
            />
            <Pressable
              onPress={() => onDeactivate(product.name)}
              style={styles.dangerChip}
            >
              <FontAwesome6 name="trash" size={9} color="#C23122" />
              <Text style={styles.dangerChipText}>Deactivate</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function OrdersSection() {
  return (
    <View>
      <SearchBox value="" onChangeText={() => undefined} placeholder="Search orders" />
      {orderRows.map((order, index) => (
        <View key={order.id} style={styles.listCard}>
          <View style={styles.listTop}>
            <View style={styles.orderIcon}>
              <FontAwesome6 name="bag-shopping" size={13} color="#C23122" />
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>{order.id}</Text>
              <Text style={styles.listMeta}>Customer #{index + 1001}</Text>
            </View>
            <StatusPill label={order.status} />
          </View>
          <View style={styles.detailGrid}>
            <MiniDetail label="Total" value={order.total} />
            <MiniDetail label="Status" value={order.status.toLowerCase()} />
            <MiniDetail label="Action" value="Update" />
          </View>
        </View>
      ))}
    </View>
  );
}

function ReferralsSection() {
  return (
    <View>
      {referralSystem.users.slice(0, 10).map((user) => {
        const sponsor = user.sponsorId
          ? referralSystem.users.find((item) => item.id === user.sponsorId)
          : null;
        const parent = user.placementParentId
          ? referralSystem.users.find((item) => item.id === user.placementParentId)
          : null;

        return (
          <View key={user.id} style={styles.listCard}>
            <Text style={styles.listTitle}>{user.name}</Text>
            <View style={styles.detailGrid}>
              <MiniDetail label="Sponsor" value={sponsor?.name ?? "None"} />
              <MiniDetail label="Parent" value={parent?.name ?? "Root"} />
              <MiniDetail label="Level" value={`${user.treeLevel}`} />
              <MiniDetail label="Position" value={`${user.placementPosition ?? "Root"}`} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function CommissionsSection() {
  return (
    <View>
      {referralSystem.commissions.slice(0, 12).map((commission) => {
        const recipient = referralSystem.users.find(
          (user) => user.id === commission.recipientId
        );
        const source = referralSystem.users.find(
          (user) => user.id === commission.sourceUserId
        );

        return (
          <View key={commission.id} style={styles.listCard}>
            <View style={styles.listTop}>
              <View style={styles.orderIcon}>
                <FontAwesome6 name="coins" size={13} color="#C23122" />
              </View>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>
                  {formatUsd(commission.amount)} - {commission.commissionType}
                </Text>
                <Text style={styles.listMeta}>
                  {recipient?.name ?? "Unknown"} from {source?.name ?? "Unknown"}
                </Text>
              </View>
              <StatusPill label={commission.status} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PaymentsSection() {
  return (
    <View>
      {paymentRows.map((payment) => (
        <View key={payment.id} style={styles.listCard}>
          <View style={styles.listTop}>
            <View style={styles.orderIcon}>
              <FontAwesome6 name="credit-card" size={13} color="#C23122" />
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>{payment.id}</Text>
              <Text style={styles.listMeta}>{payment.recipient}</Text>
            </View>
            <Text style={styles.priceText}>{formatUsd(payment.amount)}</Text>
          </View>
          <StatusPill label={payment.status} />
        </View>
      ))}
    </View>
  );
}

function NotificationsSection() {
  return (
    <View>
      {[
        "New admin login detected",
        "24 orders are waiting for review",
        "Commission payout batch is ready",
      ].map((notification) => (
        <View key={notification} style={styles.listCard}>
          <View style={styles.listTop}>
            <View style={styles.orderIcon}>
              <FontAwesome6 name="bell" size={13} color="#C23122" />
            </View>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>{notification}</Text>
              <Text style={styles.listMeta}>Admin notification</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function SettingsSection({ integrityPassed }: { integrityPassed: boolean }) {
  return (
    <View>
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Route protection</Text>
        <Text style={styles.paragraph}>
          This mobile admin scaffold checks the stored admin session and role
          before rendering /admin. Production APIs still require backend
          middleware.
        </Text>
        <StatusPill label={integrityPassed ? "Integrity OK" : "Review"} />
      </View>

      <View style={styles.listCard}>
        <Text style={styles.listTitle}>Backend authorization checklist</Text>
        {backendAuthorizationRequirements.map((item) => (
          <View key={item} style={styles.requirementRow}>
            <FontAwesome6 name="check" size={10} color="#3A8B5D" />
            <Text style={styles.requirementText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SearchBox({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchBox}>
      <FontAwesome6 name="magnifying-glass" size={13} color="#8B7F7A" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A69A95"
        style={styles.searchInput}
      />
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const isPositive =
    normalized.includes("active") ||
    normalized.includes("paid") ||
    normalized.includes("delivered") ||
    normalized.includes("ok") ||
    normalized.includes("available");

  return (
    <View style={[styles.statusPill, isPositive && styles.positivePill]}>
      <Text style={[styles.statusText, isPositive && styles.positiveStatusText]}>
        {label}
      </Text>
    </View>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniDetail}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.miniValue}>
        {value}
      </Text>
    </View>
  );
}

function ActionChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.actionChip}>
      <FontAwesome6 name={icon as any} size={9} color="#C23122" />
      <Text style={styles.actionChipText}>{label}</Text>
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

  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  centerTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
    marginTop: 14,
    textAlign: "center",
  },

  centerText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: "center",
  },

  primaryButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  kicker: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  title: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 22,
    marginTop: 2,
  },

  logoutButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },

  navScroll: {
    gap: 8,
    paddingBottom: 12,
  },

  navChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    height: 38,
    paddingHorizontal: 12,
  },

  activeNavChip: {
    backgroundColor: "#C23122",
    borderColor: "#C23122",
  },

  navChipText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  activeNavChipText: {
    color: "#FFFFFF",
  },

  pressed: {
    opacity: 0.72,
  },

  content: {
    paddingBottom: 34,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 100,
    padding: 13,
  },

  summaryIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },

  summaryLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 10,
  },

  summaryValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 19,
    marginTop: 3,
  },

  searchBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
    paddingHorizontal: 12,
  },

  searchInput: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    minHeight: 44,
  },

  listCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0E4DF",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },

  listTop: {
    alignItems: "center",
    flexDirection: "row",
  },

  avatar: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  avatarText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  productIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  orderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  listCopy: {
    flex: 1,
    marginLeft: 10,
  },

  listTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  listMeta: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginTop: 2,
  },

  statusPill: {
    backgroundColor: "#FFF1EF",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  positivePill: {
    backgroundColor: "#EAF5EE",
  },

  statusText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  positiveStatusText: {
    color: "#2C7447",
  },

  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  miniDetail: {
    backgroundColor: "#FFF8F2",
    borderRadius: 8,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 48,
    padding: 9,
  },

  miniLabel: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 8,
  },

  miniValue: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    marginTop: 3,
  },

  addButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 44,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  priceText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },

  actionChip: {
    alignItems: "center",
    backgroundColor: "#FFF1EF",
    borderRadius: 8,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  actionChipText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  dangerChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  dangerChipText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 9,
  },

  paragraph: {
    color: "#6C625F",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: 7,
  },

  requirementRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  requirementText: {
    color: "#6C625F",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
  },
});
