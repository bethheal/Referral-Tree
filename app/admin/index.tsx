import {
  AdminAuditRow,
  AdminManagedUser,
  AdminModule,
  AdminProduct,
  AdminSummaryResponse,
  createAdminProduct,
  decideAdminApproval,
  getAdminResource,
  getAdminUserDetail,
  getAdminAuditLog,
  getAdminSummary,
  getAdminUsers,
  setAdminUserRole,
  setAdminUserStatus,
  revokeAdminUserSessions,
  updateAdminProduct,
} from "@/components/backendApi";
import {
  AdminSession,
  getAdminSession,
  isAdminRole,
  logoutAdminAccount,
  verifyAdminSession,
} from "@/components/adminAccess";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Section = "Overview" | "Users" | "Memberships" | "Payments" | "Reconciliation" | "Referrals" | "Ledger" | "Withdrawals" | "Products" | "Orders" | "Invoices" | "Notifications" | "Security" | "Approvals" | "Audit log";
type PendingAction =
  | { kind: "status"; user: AdminManagedUser; nextStatus: "ACTIVE" | "SUSPENDED" }
  | { kind: "role"; user: AdminManagedUser; nextRole: "USER" | "ADMIN" }
  | { kind: "sessions"; user: AdminManagedUser }
  | null;

const sections: { name: Section; icon: string }[] = [
  { name: "Overview", icon: "chart-line" },
  { name: "Users", icon: "users" },
  { name: "Memberships", icon: "id-card" },
  { name: "Payments", icon: "credit-card" },
  { name: "Reconciliation", icon: "rotate" },
  { name: "Referrals", icon: "share-nodes" },
  { name: "Ledger", icon: "book" },
  { name: "Withdrawals", icon: "money-bill-transfer" },
  { name: "Products", icon: "boxes-stacked" },
  { name: "Orders", icon: "basket-shopping" },
  { name: "Invoices", icon: "file-invoice" },
  { name: "Notifications", icon: "bell" },
  { name: "Security", icon: "shield-halved" },
  { name: "Approvals", icon: "user-check" },
  { name: "Audit log", icon: "clipboard-list" },
];

const sectionModule: Partial<Record<Section, AdminModule>> = {
  Memberships: "memberships", Payments: "payments", Reconciliation: "payment-events", Referrals: "referrals", Ledger: "ledger", Withdrawals: "withdrawals",
  Products: "products", Orders: "orders", Invoices: "invoices", Notifications: "notifications",
  Security: "security", Approvals: "approvals",
};

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AdminDashboard() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [section, setSection] = useState<Section>("Overview");
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [auditRows, setAuditRows] = useState<AdminAuditRow[]>([]);
  const [moduleRows, setModuleRows] = useState<Record<string, unknown>[]>([]);
  const [moduleCount, setModuleCount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditActorFilter, setAuditActorFilter] = useState("");
  const [auditTargetFilter, setAuditTargetFilter] = useState("");
  const [auditSinceFilter, setAuditSinceFilter] = useState("");
  const [auditUntilFilter, setAuditUntilFilter] = useState("");
  const [detailUser, setDetailUser] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const stored = await getAdminSession();
        if (!stored || !isAdminRole(stored.role)) {
          router.replace("/admin/login");
          return;
        }
        const verified = await verifyAdminSession();
        if (active) setSession({ ...stored, name: verified.fullName, role: verified.role });
      } catch {
        if (active) setError("Admin access could not be verified. Sign in again.");
      } finally {
        if (active) setChecking(false);
      }
    };
    void verify();
    return () => { active = false; };
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await getAdminSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load admin overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminUsers({ limit: pageSize, offset, search });
      setUsers(response.rows);
      setUserCount(response.count);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [offset, pageSize, search]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminAuditLog({ limit: pageSize, offset, action: auditActionFilter, actorUserId: auditActorFilter, targetId: auditTargetFilter, since: auditSinceFilter, until: auditUntilFilter });
      setAuditRows(response.rows);
      setModuleCount(response.count);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load audit history.");
    } finally {
      setLoading(false);
    }
  }, [offset, pageSize, auditActionFilter, auditActorFilter, auditTargetFilter, auditSinceFilter, auditUntilFilter]);

  const loadModule = useCallback(async (module: AdminModule) => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminResource(module, { limit: pageSize, offset, ...(module === "products" && search.trim() ? { search: search.trim() } : {}) });
      setModuleRows(response.rows);
      setModuleCount(response.count);
    } catch (cause) {
      setModuleRows([]);
      setModuleCount(0);
      setError(cause instanceof Error ? cause.message : `Could not load ${module}.`);
    } finally {
      setLoading(false);
    }
  }, [offset, pageSize, search]);

  useEffect(() => {
    if (!session) return;
    if (section === "Overview") void loadOverview();
    if (section === "Users") void loadUsers();
    if (section === "Audit log") void loadAudit();
    const module = sectionModule[section];
    if (module) void loadModule(module);
  }, [section, session, loadOverview, loadUsers, loadAudit, loadModule]);

  const logout = async () => {
    setSaving(true);
    try {
      await logoutAdminAccount();
      router.replace("/auth/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const submitAction = async () => {
    if (!action || reason.trim().length < 8) return;
    setSaving(true);
    setError("");
    try {
      if (action.kind === "status") {
        await setAdminUserStatus(action.user.id, action.nextStatus, reason.trim());
      } else if (action.kind === "sessions") {
        const result = await revokeAdminUserSessions(action.user.id, reason.trim());
        setFeedback(`${result.revokedSessions} active session(s) revoked for ${result.user.fullName}.`);
      } else {
        const result = await setAdminUserRole(action.user.id, action.nextRole, reason.trim());
        if (result.approvalRequired) setFeedback("Role change submitted. A different administrator must approve it before access changes.");
      }
      setAction(null);
      setReason("");
      await Promise.all([loadUsers(), loadAudit(), loadOverview()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The admin action failed.");
    } finally {
      setSaving(false);
    }
  };

  const viewUser = async (user: AdminManagedUser) => {
    setDetailLoading(true); setError("");
    try { setDetailUser((await getAdminUserDetail(user.id)).user); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load user details."); }
    finally { setDetailLoading(false); }
  };

  if (checking) {
    return <CenteredState title="Checking administrator access" detail="Verifying your signed-in account with the server." busy />;
  }
  if (!session) {
    return <CenteredState title="Admin access unavailable" detail={error || "Sign in with an authorized administrator account."} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ANGEL FOODS · ADMIN</Text>
          <Text style={styles.title}>Hello, {session.name}</Text>
          <Text style={styles.subTitle}>{session.role.replace("_", " ")}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out" disabled={saving} onPress={() => void logout()} style={styles.logout}>
          <FontAwesome6 name="right-from-bracket" size={16} color={palette.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {sections.map((item) => (
          <Pressable key={item.name} accessibilityRole="tab" accessibilityState={{ selected: section === item.name }} onPress={() => setSection(item.name)} style={[styles.tab, section === item.name && styles.activeTab]}>
            <FontAwesome6 name={item.icon as never} size={13} color={section === item.name ? "#FFFFFF" : palette.ink} />
            <Text style={[styles.tabText, section === item.name && styles.activeTabText]}>{item.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.devWarning}><Text style={styles.devWarningText}>Development admin console. Records load from the authenticated backend; this environment is not production.</Text></View>

      {error ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => section === "Overview" ? void loadOverview() : section === "Users" ? void loadUsers() : section === "Audit log" ? void loadAudit() : sectionModule[section] ? void loadModule(sectionModule[section]!) : undefined}><Text style={styles.retry}>Retry</Text></Pressable>
        </View>
      ) : null}
      {feedback ? <View accessibilityLiveRegion="polite" style={styles.successBox}><Text style={styles.successText}>{feedback}</Text></View> : null}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color={palette.green} style={styles.loader} /> : null}
        {section === "Overview" ? <Overview summary={summary} onRefresh={() => void loadOverview()} /> : null}
        {section === "Users" ? (
          <UsersPanel
            users={users}
            count={userCount}
            offset={offset}
            pageSize={pageSize}
            search={search}
            setSearch={(value) => { setSearch(value); setOffset(0); }}
            onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
            onNext={() => setOffset((value) => value + pageSize)}
            isSuperAdmin={session.role === "super_admin"}
            currentAdminEmail={session.email}
            onStatus={(user) => {
              setReason("");
              setAction({ kind: "status", user, nextStatus: user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED" });
            }}
            onRole={(user) => {
              setReason("");
              setAction({ kind: "role", user, nextRole: user.role === "ADMIN" ? "USER" : "ADMIN" });
            }}
            onView={(user) => void viewUser(user)}
            onRevokeSessions={(user) => { setReason(""); setAction({ kind: "sessions", user }); }}
          />
        ) : null}
        {section === "Audit log" ? <AuditPanel rows={auditRows} count={moduleCount} offset={offset} pageSize={pageSize} filters={{ action: auditActionFilter, actor: auditActorFilter, target: auditTargetFilter, since: auditSinceFilter, until: auditUntilFilter }} setters={{ action: setAuditActionFilter, actor: setAuditActorFilter, target: setAuditTargetFilter, since: setAuditSinceFilter, until: setAuditUntilFilter }} onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))} onNext={() => setOffset((value) => value + pageSize)} /> : null}
        {sectionModule[section] ? <AdminRecordsPanel module={sectionModule[section]!} rows={moduleRows} count={moduleCount} offset={offset} pageSize={pageSize} onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))} onNext={() => setOffset((value) => value + pageSize)} onRefresh={() => void loadModule(sectionModule[section]!)} onProductSaved={() => void loadModule("products")} /> : null}
      </ScrollView>

      <Modal transparent visible={Boolean(action)} animationType="fade" onRequestClose={() => !saving && setAction(null)}>
        <View style={styles.modalShade}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>{action?.kind === "status" ? `${action.nextStatus === "SUSPENDED" ? "Suspend" : "Reinstate"} account` : action?.kind === "role" ? `${action.nextRole === "ADMIN" ? "Grant" : "Remove"} admin access` : "Revoke all active sessions"}</Text>
            <Text style={styles.modalDescription}>{action?.user.fullName} · {action?.user.email}{"\n"}This change is checked by the backend and recorded in the admin audit log. Provide a reason (at least 8 characters).</Text>
            <TextInput accessibilityLabel="Reason for administrator action" editable={!saving} multiline maxLength={500} onChangeText={setReason} placeholder="Reason" style={styles.reasonInput} value={reason} />
            <View style={styles.modalButtons}>
              <Pressable disabled={saving} onPress={() => setAction(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable disabled={saving || reason.trim().length < 8} onPress={() => void submitAction()} style={[styles.confirmButton, (saving || reason.trim().length < 8) && styles.disabled]}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Confirm</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {section === "Users" ? <UserDetailDialog user={detailUser} loading={detailLoading} onClose={() => setDetailUser(null)} /> : null}
    </SafeAreaView>
  );
}

function Overview({ summary, onRefresh }: { summary: AdminSummaryResponse | null; onRefresh: () => void }) {
  if (!summary) return <Empty message="No overview data received yet." action="Refresh overview" onAction={onRefresh} />;
  const cards = [
    ["Accounts", summary.accounts.total],
    ["Active", summary.accounts.active],
    ["Pending verification", summary.accounts.pendingVerification],
    ["Suspended", summary.accounts.suspended],
    ["Administrators", summary.accounts.admins + summary.accounts.superAdmins],
    ["Active memberships", summary.memberships.totalActive],
    ["Payments pending", summary.memberships.pendingPayments],
    ["Payments successful", summary.memberships.successfulPayments],
    ["Payments failed", summary.memberships.failedPayments],
    ["Cash-outs pending review", summary.cashOuts.pendingReview],
    ["Failed logins · 24h", summary.security.failedLoginsLast24Hours],
    ["Denied admin logins · 24h", summary.security.deniedAdminLoginsLast24Hours],
  ] as const;
  return (
    <View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Overview</Text><Pressable accessibilityRole="button" onPress={onRefresh}><Text style={styles.retry}>Refresh</Text></Pressable></View>
      <Text style={styles.muted}>Counts from the backend account and payment records.</Text>
      <View style={styles.cardGrid}>{cards.map(([label, value]) => <View key={label} style={styles.metricCard}><Text style={styles.metricValue}>{value.toLocaleString()}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Active memberships by plan</Text>
        <View style={styles.planRow}><Text style={styles.planName}>Silver</Text><Text style={styles.planValue}>{summary.memberships.byPlan.silver}</Text></View>
        <View style={styles.planRow}><Text style={styles.planName}>Gold</Text><Text style={styles.planValue}>{summary.memberships.byPlan.gold}</Text></View>
        <View style={styles.planRow}><Text style={styles.planName}>Premium</Text><Text style={styles.planValue}>{summary.memberships.byPlan.premium}</Text></View>
      </View>
      <View style={styles.notice}><Text style={styles.noticeText}>Revenue and payout actions are not shown here because approved accounting rules and production database persistence are not configured.</Text></View>
    </View>
  );
}

function UsersPanel({
  users, count, offset, pageSize, search, setSearch, onPrevious, onNext,
  isSuperAdmin, currentAdminEmail, onStatus, onRole, onView, onRevokeSessions,
}: {
  users: AdminManagedUser[]; count: number; offset: number; pageSize: number; search: string;
  setSearch: (value: string) => void; onPrevious: () => void; onNext: () => void;
  isSuperAdmin: boolean; currentAdminEmail: string; onStatus: (user: AdminManagedUser) => void; onRole: (user: AdminManagedUser) => void;
  onView: (user: AdminManagedUser) => void; onRevokeSessions: (user: AdminManagedUser) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>User management</Text>
      <Text style={styles.muted}>Search by name, email, or phone. Sensitive changes require a reason.</Text>
      <View style={styles.searchBox}><FontAwesome6 name="magnifying-glass" size={14} color={palette.muted} /><TextInput accessibilityLabel="Search users" onChangeText={setSearch} placeholder="Search users" placeholderTextColor={palette.muted} style={styles.searchInput} value={search} /></View>
      {users.length === 0 ? <Empty message="No users match this search." /> : users.map((user) => {
        const self = user.email.toLowerCase() === currentAdminEmail.toLowerCase();
        const protectedAdmin = user.role === "SUPER_ADMIN";
        const canEditRole = isSuperAdmin && !self && !protectedAdmin;
        const canEditStatus = !self && !protectedAdmin && user.status !== "PENDING_VERIFICATION";
        return (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userTop}>
              <View style={styles.userIdentity}><Text style={styles.userName}>{user.fullName}</Text><Text style={styles.userEmail}>{user.email}</Text><Text style={styles.userMeta}>{user.membershipTier.toUpperCase()} · Joined {new Date(user.createdAt).toLocaleDateString()}</Text></View>
              <View style={styles.badges}><Badge label={user.role.replace("_", " ")} /><Badge label={user.status.replaceAll("_", " ")} /></View>
            </View>
            <View style={styles.userActions}>
              <Pressable accessibilityRole="button" onPress={() => onView(user)} style={styles.actionButton}><Text style={styles.actionText}>View details</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => onRevokeSessions(user)} style={styles.actionButton}><Text style={styles.actionText}>Revoke sessions</Text></Pressable>
              {canEditStatus ? <Pressable accessibilityRole="button" onPress={() => onStatus(user)} style={styles.actionButton}><Text style={styles.actionText}>{user.status === "SUSPENDED" ? "Reinstate" : "Suspend"}</Text></Pressable> : null}
              {canEditRole ? <Pressable accessibilityRole="button" onPress={() => onRole(user)} style={styles.actionButton}><Text style={styles.actionText}>{user.role === "ADMIN" ? "Remove admin" : "Make admin"}</Text></Pressable> : null}
              {self ? <Text style={styles.muted}>Your account</Text> : null}
              {protectedAdmin ? <Text style={styles.muted}>Protected administrator</Text> : null}
              {user.status === "PENDING_VERIFICATION" ? <Text style={styles.muted}>Verification pending</Text> : null}
            </View>
          </View>
        );
      })}
      <View style={styles.pagination}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: offset === 0 }} disabled={offset === 0} onPress={onPrevious} style={[styles.pageButton, offset === 0 && styles.disabled]}><Text style={styles.pageText}>Previous</Text></Pressable>
        <Text style={styles.muted}>{count === 0 ? 0 : offset + 1}–{Math.min(offset + pageSize, count)} of {count}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: offset + pageSize >= count }} disabled={offset + pageSize >= count} onPress={onNext} style={[styles.pageButton, offset + pageSize >= count && styles.disabled]}><Text style={styles.pageText}>Next</Text></Pressable>
      </View>
    </View>
  );
}

function AuditPanel({ rows, count, offset, pageSize, filters, setters, onPrevious, onNext }: {
  rows: AdminAuditRow[]; count: number; offset: number; pageSize: number;
  filters: { action: string; actor: string; target: string; since: string; until: string };
  setters: { action: (value: string) => void; actor: (value: string) => void; target: (value: string) => void; since: (value: string) => void; until: (value: string) => void };
  onPrevious: () => void; onNext: () => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Administrative audit log</Text>
      <Text style={styles.muted}>Filter immutable, persisted entries by action, actor, target, or ISO timestamp range.</Text>
      <TextInput accessibilityLabel="Filter by action" value={filters.action} onChangeText={setters.action} placeholder="Action (e.g. ADMIN_PRODUCT_CREATED)" style={styles.inlineInput} />
      <TextInput accessibilityLabel="Filter by actor user ID" value={filters.actor} onChangeText={setters.actor} placeholder="Actor user ID" style={styles.inlineInput} />
      <TextInput accessibilityLabel="Filter by target user ID" value={filters.target} onChangeText={setters.target} placeholder="Target user ID" style={styles.inlineInput} />
      <View style={styles.inlineActions}><TextInput accessibilityLabel="Audit start date" value={filters.since} onChangeText={setters.since} placeholder="Since (ISO date)" style={[styles.inlineInput, styles.dateFilter]} /><TextInput accessibilityLabel="Audit end date" value={filters.until} onChangeText={setters.until} placeholder="Until (ISO date)" style={[styles.inlineInput, styles.dateFilter]} /></View>
      {rows.length === 0 ? <Empty message="No administrative actions recorded yet." /> : rows.map((row) => (
        <View key={row.id} style={styles.auditCard}>
          <View style={styles.auditTop}><Text style={styles.auditAction}>{row.action.replaceAll("_", " ")}</Text><Text style={styles.auditDate}>{formatDate(row.createdAt)}</Text></View>
          <Text style={styles.auditDetail}>Actor: {row.actorUserId ?? "Backend operator"} · Target: {row.targetType ? `${row.targetType}: ${row.targetId}` : row.targetId ?? row.targetUserId ?? "—"} · IP: {row.ipAddress ?? "not recorded"}</Text>
          {row.reason ? <Text style={styles.auditReason}>Reason: {row.reason}</Text> : null}
        </View>
      ))}
      <View style={styles.pagination}><Pressable accessibilityRole="button" disabled={offset === 0} onPress={onPrevious} style={[styles.pageButton, offset === 0 && styles.disabled]}><Text style={styles.pageText}>Previous</Text></Pressable><Text style={styles.muted}>{count === 0 ? 0 : offset + 1}–{Math.min(offset + pageSize, count)} of {count}</Text><Pressable accessibilityRole="button" disabled={offset + pageSize >= count} onPress={onNext} style={[styles.pageButton, offset + pageSize >= count && styles.disabled]}><Text style={styles.pageText}>Next</Text></Pressable></View>
    </View>
  );
}

function UserDetailDialog({ user, loading, onClose }: { user: Record<string, unknown> | null; loading: boolean; onClose: () => void }) {
  const visible = loading || user !== null;
  const sessions = Array.isArray(user?.sessions) ? user.sessions as Record<string, unknown>[] : [];
  const memberships = Array.isArray(user?.memberships) ? user.memberships as Record<string, unknown>[] : [];
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalShade}><View accessibilityViewIsModal style={styles.modalCard}>
      <Text style={styles.modalTitle}>User details</Text>
      {loading ? <ActivityIndicator color={palette.green} /> : user ? <>
        <Text style={styles.recordDetail}>{String(user.fullName)} · {String(user.email)}</Text>
        <Text style={styles.recordDetail}>Role: {String(user.role)} · Status: {String(user.status)}</Text>
        <Text style={styles.recordDetail}>Admin MFA: {user.mfaEnabled ? "Enabled" : "Not enrolled"}</Text>
        <Text style={styles.panelTitle}>Current memberships ({memberships.length})</Text>
        {memberships.map((item) => {
          const plan = item.plan && typeof item.plan === "object" ? item.plan as Record<string, unknown> : {};
          return <Text key={String(item.id)} style={styles.recordDetail}>{String(plan.displayName ?? plan.code)} · {String(item.status)}{item.expiresAt ? ` · expires ${formatDate(String(item.expiresAt))}` : ""}</Text>;
        })}
        <Text style={styles.panelTitle}>Active sessions ({sessions.length})</Text>
        {sessions.map((session) => <Text key={String(session.id)} style={styles.recordDetail}>IP: {String(session.ipAddress ?? "not recorded")} · Last seen: {session.lastSeenAt ? formatDate(String(session.lastSeenAt)) : "unknown"}</Text>)}
      </> : null}
      <View style={styles.modalButtons}><Pressable disabled={loading} onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Close</Text></Pressable></View>
    </View></View>
  </Modal>;
}

function AdminRecordsPanel({
  module, rows, count, offset, pageSize, onPrevious, onNext, onRefresh, onProductSaved,
}: {
  module: AdminModule; rows: Record<string, unknown>[]; count: number; offset: number; pageSize: number;
  onPrevious: () => void; onNext: () => void; onRefresh: () => void; onProductSaved: () => void;
}) {
  const [editor, setEditor] = useState<AdminProduct | null | "new">(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMinor, setPriceMinor] = useState("");
  const [inventory, setInventory] = useState("0");
  const [productStatus, setProductStatus] = useState<AdminProduct["status"]>("DRAFT");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [approvalReasons, setApprovalReasons] = useState<Record<string, string>>({});
  const [deciding, setDeciding] = useState<string | null>(null);

  const openEditor = (product: AdminProduct | null) => {
    setEditor(product ?? "new"); setSku(product?.sku ?? ""); setName(product?.name ?? "");
    setDescription(product?.description ?? ""); setPriceMinor(product?.priceMinor ?? "");
    setInventory(String(product?.inventoryCount ?? 0)); setProductStatus(product?.status ?? "DRAFT"); setReason(""); setMessage("");
  };

  const saveProduct = async () => {
    if (reason.trim().length < 8 || !sku.trim() || !name.trim() || !/^\d+$/.test(priceMinor) || !/^\d+$/.test(inventory)) return;
    setSaving(true); setMessage("");
    try {
      const input = { sku: sku.trim(), name: name.trim(), description: description.trim(), imageKey: editor !== "new" && editor ? editor.imageKey : null, priceMinor, currency: "GHS", inventoryCount: Number(inventory), status: productStatus, reason: reason.trim() } as const;
      if (editor && editor !== "new") await updateAdminProduct(editor.id, input);
      else await createAdminProduct(input);
      setEditor(null); setMessage("Product changes saved and recorded in the audit log."); onProductSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save product."); }
    finally { setSaving(false); }
  };

  const decide = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const decisionReason = approvalReasons[id]?.trim() ?? "";
    if (decisionReason.length < 8) return;
    setDeciding(id); setMessage("");
    try { await decideAdminApproval(id, decision, decisionReason); setMessage(`Approval ${decision.toLowerCase()}.`); onRefresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not decide approval."); }
    finally { setDeciding(null); }
  };

  const titleFor = (row: Record<string, unknown>) => {
    const nested = (key: string) => row[key] && typeof row[key] === "object" ? row[key] as Record<string, unknown> : {};
    const user = nested("user"); const plan = nested("plan"); const notification = nested("notification");
    if (module === "memberships") return `${String(plan.displayName ?? plan.code ?? "Membership")} · ${String(user.fullName ?? "Account")}`;
    if (module === "payments") return `${String(row.reference ?? "Payment")} · ${String(user.fullName ?? "")}`;
    if (module === "payment-events") return `${String(row.eventType ?? "Payment event")} · ${String(row.providerEventId ?? row.id ?? "")}`;
    if (module === "referrals") return String(row.fullName ?? "Referral");
    if (module === "ledger") return String(row.description ?? row.type ?? "Ledger entry");
    if (module === "withdrawals") return `Withdrawal · ${String(user.fullName ?? "Account")}`;
    if (module === "products") return String(row.name ?? "Product");
    if (module === "orders") return String(row.orderNumber ?? "Order");
    if (module === "invoices") return String(row.invoiceNumber ?? "Invoice");
    if (module === "notifications") return String(notification.title ?? "Notification delivery");
    if (module === "security") return String(row.fullName ?? "Administrator");
    if (module === "approvals") return String(row.action ?? "Approval request").replaceAll("_", " ");
    return String(row.id ?? "Record");
  };

  const detailsFor = (row: Record<string, unknown>) => {
    const user = row.user && typeof row.user === "object" ? row.user as Record<string, unknown> : {};
    const fields: string[] = module === "memberships" ? ["status", "startsAt", "expiresAt", "createdAt"]
      : module === "payments" ? ["targetType", "status", "amountMinor", "currency", "createdAt", "paidAt"]
      : module === "payment-events" ? ["processingStatus", "signatureVerified", "payloadHash", "receivedAt"]
      : module === "referrals" ? ["status", "joinedAt", "directReferrals"]
      : module === "ledger" ? ["type", "state", "amountMinor", "currency", "referenceId", "createdAt"]
      : module === "withdrawals" ? ["status", "amountMinor", "feeMinor", "currency", "createdAt"]
      : module === "products" ? ["sku", "status", "priceMinor", "currency", "inventoryCount", "updatedAt"]
      : module === "orders" ? ["status", "totalMinor", "currency", "createdAt"]
      : module === "invoices" ? ["status", "totalMinor", "currency", "issuedAt"]
      : module === "notifications" ? ["status", "channel", "attemptCount", "sentAt", "lastErrorCode"]
      : module === "security" ? ["role", "status", "mfaEnabled"]
      : ["status", "targetType", "targetId", "requestedAt", "reason"];
    const output = fields.filter((field) => row[field] !== undefined && row[field] !== null).map((field) => {
      let value = row[field];
      if (field === "amountMinor" || field === "feeMinor" || field === "totalMinor" || field === "priceMinor") value = `${(Number(value) / 100).toFixed(2)} ${String(row.currency ?? "")}`;
      if (field === "payloadHash" && typeof value === "string") value = `${value.slice(0, 16)}…`;
      if (field === "signatureVerified" || field === "mfaEnabled") value = value ? "Yes" : "No";
      if (typeof value === "string" && field.endsWith("At")) value = formatDate(value);
      return `${field.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}: ${String(value)}`;
    });
    if (user.fullName) output.unshift(`Account: ${String(user.fullName)} (${String(user.email ?? "")})`);
    const plan = row.plan && typeof row.plan === "object" ? row.plan as Record<string, unknown> : null;
    if (plan) output.unshift(`Plan: ${String(plan.displayName ?? plan.code ?? "")}`);
    if (module === "orders" && Array.isArray(row.items)) output.push(`Items: ${row.items.length}`);
    if (module === "security") output.push(`Active sessions: ${Array.isArray(row.sessions) ? row.sessions.length : 0}`);
    return output;
  };

  return (
    <View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{module.replaceAll("-", " ").replace(/^./, (char) => char.toUpperCase())}</Text>
        <View style={styles.inlineActions}>
          {module === "products" ? <Pressable accessibilityRole="button" onPress={() => openEditor(null)} style={styles.pageButton}><Text style={styles.pageText}>Add product</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={onRefresh}><Text style={styles.retry}>Refresh</Text></Pressable>
        </View>
      </View>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.moduleMessage}>{message}</Text> : null}
      {module === "payment-events" ? <View style={styles.notice}><Text style={styles.noticeText}>This is the persisted reconciliation queue. Events are read-only until Flutterwave sandbox verification and matching rules are approved. Payload content is never returned.</Text></View> : null}
      {module === "orders" ? <View style={styles.notice}><Text style={styles.noticeText}>Orders and invoices are read-only. Status changes are disabled until allowed transitions and financial effects are approved.</Text></View> : null}
      {module === "notifications" ? <View style={styles.notice}><Text style={styles.noticeText}>Delivery history is shown from persisted records. Broadcasts are disabled until a recipient policy and delivery provider are configured.</Text></View> : null}
      {module === "security" ? <View style={styles.notice}><Text style={styles.noticeText}>MFA secrets, recovery codes, and session tokens are never displayed. Authenticator reset remains CLI-only.</Text></View> : null}
      {module === "approvals" ? <Text style={styles.muted}>Role changes require a different MFA-verified administrator. The bootstrap exception applies only while no active administrator exists.</Text> : null}
      {rows.length === 0 ? <Empty message="No persisted records found." action="Retry" onAction={onRefresh} /> : rows.map((row, index) => {
        const product = module === "products" ? row as AdminProduct : null;
        return (
          <View key={String(row.id ?? index)} style={styles.recordCard}>
            <View style={styles.recordHeading}><Text style={styles.recordTitle}>{titleFor(row)}</Text><Text style={styles.recordBadge}>{String(row.status ?? row.processingStatus ?? "RECORDED").replaceAll("_", " ")}</Text></View>
            {detailsFor(row).map((detail) => <Text key={detail} style={styles.recordDetail}>{detail}</Text>)}
            {module === "approvals" ? (
              <>
                <TextInput accessibilityLabel="Approval decision reason" editable={deciding !== String(row.id)} value={approvalReasons[String(row.id)] ?? ""} onChangeText={(value) => setApprovalReasons((current) => ({ ...current, [String(row.id)]: value }))} placeholder="Decision reason (8–500 characters)" style={styles.inlineInput} />
                <View style={styles.inlineActions}><Pressable disabled={deciding === String(row.id) || (approvalReasons[String(row.id)] ?? "").trim().length < 8} onPress={() => void decide(String(row.id), "APPROVED")} style={styles.actionButton}><Text style={styles.actionText}>Approve</Text></Pressable><Pressable disabled={deciding === String(row.id) || (approvalReasons[String(row.id)] ?? "").trim().length < 8} onPress={() => void decide(String(row.id), "REJECTED")} style={styles.actionButton}><Text style={styles.actionText}>Reject</Text></Pressable></View>
              </>
            ) : null}
            {product ? <Pressable accessibilityRole="button" onPress={() => openEditor(product)} style={styles.actionButton}><Text style={styles.actionText}>Edit product</Text></Pressable> : null}
          </View>
        );
      })}
      <View style={styles.pagination}>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: offset === 0 }} disabled={offset === 0} onPress={onPrevious} style={[styles.pageButton, offset === 0 && styles.disabled]}><Text style={styles.pageText}>Previous</Text></Pressable>
        <Text style={styles.muted}>{count === 0 ? 0 : offset + 1}–{Math.min(offset + pageSize, count)} of {count}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: offset + pageSize >= count }} disabled={offset + pageSize >= count} onPress={onNext} style={[styles.pageButton, offset + pageSize >= count && styles.disabled]}><Text style={styles.pageText}>Next</Text></Pressable>
      </View>
      <Modal transparent visible={Boolean(editor)} animationType="fade" onRequestClose={() => !saving && setEditor(null)}>
        <View style={styles.modalShade}><View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.modalTitle}>{editor === "new" ? "Add product" : "Edit product"}</Text>
          <TextInput accessibilityLabel="Product SKU" editable={!saving} value={sku} onChangeText={setSku} placeholder="SKU" style={styles.inlineInput} />
          <TextInput accessibilityLabel="Product name" editable={!saving} value={name} onChangeText={setName} placeholder="Product name" style={styles.inlineInput} />
          <TextInput accessibilityLabel="Product description" editable={!saving} value={description} onChangeText={setDescription} placeholder="Description" multiline style={[styles.inlineInput, styles.reasonInput]} />
          <TextInput accessibilityLabel="Price in minor currency units" editable={!saving} value={priceMinor} onChangeText={setPriceMinor} placeholder="Price (minor units; e.g. 1250 = GHS 12.50)" keyboardType="numeric" style={styles.inlineInput} />
          <TextInput accessibilityLabel="Inventory count" editable={!saving} value={inventory} onChangeText={setInventory} placeholder="Inventory count" keyboardType="numeric" style={styles.inlineInput} />
          <View style={styles.inlineActions}>{(["DRAFT", "ACTIVE", "ARCHIVED"] as const).map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: productStatus === status }} onPress={() => setProductStatus(status)} style={[styles.actionButton, productStatus === status && styles.selectedAction]}><Text style={styles.actionText}>{status}</Text></Pressable>)}</View>
          <TextInput accessibilityLabel="Reason for product changes" editable={!saving} value={reason} onChangeText={setReason} placeholder="Reason (8–500 characters)" multiline style={styles.reasonInput} />
          <View style={styles.modalButtons}><Pressable disabled={saving} onPress={() => setEditor(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving || reason.trim().length < 8 || !sku.trim() || !name.trim() || !/^\d+$/.test(priceMinor)} onPress={() => void saveProduct()} style={[styles.confirmButton, (saving || reason.trim().length < 8) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Save</Text>}</Pressable></View>
        </View></View>
      </Modal>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return <View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>;
}

function Empty({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return <View style={styles.empty}><Text style={styles.muted}>{message}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.retry}>{action}</Text></Pressable> : null}</View>;
}

function CenteredState({ title, detail, busy = false }: { title: string; detail: string; busy?: boolean }) {
  return <SafeAreaView style={styles.screen}><View style={styles.center}>{busy ? <ActivityIndicator color={palette.green} /> : <FontAwesome6 name="shield-halved" size={26} color={palette.green} />}<Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View></SafeAreaView>;
}

const palette = { ink: "#172334", green: "#1F6A4A", muted: "#75818E", border: "#E1E7E5", surface: "#FFFFFF", canvas: "#F5F8F7", red: "#A73333" };
const styles = StyleSheet.create({
  screen: { backgroundColor: palette.canvas, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  headerText: { flex: 1 }, eyebrow: { color: palette.green, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: palette.ink, fontSize: 23, fontWeight: "800", marginTop: 3 }, subTitle: { color: palette.muted, fontSize: 11, marginTop: 3, textTransform: "capitalize" },
  logout: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  tabs: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 }, tab: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 42, paddingHorizontal: 13 }, activeTab: { backgroundColor: palette.ink, borderColor: palette.ink }, tabText: { color: palette.ink, fontSize: 12, fontWeight: "700" }, activeTabText: { color: "#FFFFFF" },
  devWarning: { backgroundColor: "#FFF4D9", marginHorizontal: 18, marginBottom: 5, padding: 10, borderRadius: 9 }, devWarningText: { color: "#735814", fontSize: 11, lineHeight: 16 },
  content: { gap: 12, padding: 18, paddingBottom: 40 }, loader: { marginVertical: 14 }, errorBox: { backgroundColor: "#FFF0EF", borderRadius: 10, marginHorizontal: 18, padding: 12 }, errorText: { color: palette.red, fontSize: 12 }, retry: { color: palette.green, fontSize: 12, fontWeight: "800", marginTop: 8 }, successBox: { backgroundColor: "#EAF3EF", borderRadius: 10, marginHorizontal: 18, padding: 12 }, successText: { color: palette.green, fontSize: 12, lineHeight: 18 },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: "800", marginBottom: 4 }, muted: { color: palette.muted, fontSize: 12, lineHeight: 18 }, cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }, metricCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 13, borderWidth: 1, flexBasis: "47%", flexGrow: 1, minHeight: 98, padding: 14 }, metricValue: { color: palette.ink, fontSize: 24, fontWeight: "800" }, metricLabel: { color: palette.muted, fontSize: 11, marginTop: 7 }, panel: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 13, borderWidth: 1, marginTop: 14, padding: 16 }, panelTitle: { color: palette.ink, fontSize: 14, fontWeight: "800", marginBottom: 8 }, planRow: { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }, planName: { color: palette.ink, fontSize: 13 }, planValue: { color: palette.ink, fontSize: 13, fontWeight: "800" }, notice: { backgroundColor: "#FFF8E7", borderRadius: 10, marginTop: 14, padding: 13 }, noticeText: { color: "#745A1B", fontSize: 12, lineHeight: 18 },
  searchBox: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 14, minHeight: 46, paddingHorizontal: 12 }, searchInput: { color: palette.ink, flex: 1, fontSize: 14, minHeight: 44 }, userCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 13, borderWidth: 1, marginTop: 10, padding: 14 }, userTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, userIdentity: { flex: 1, paddingRight: 8 }, userName: { color: palette.ink, fontSize: 14, fontWeight: "800" }, userEmail: { color: palette.muted, fontSize: 12, marginTop: 3 }, userMeta: { color: palette.muted, fontSize: 10, marginTop: 6 }, badges: { alignItems: "flex-end", gap: 5 }, badge: { backgroundColor: "#EAF3EF", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { color: palette.green, fontSize: 9, fontWeight: "800" }, userActions: { alignItems: "center", borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 10 }, actionButton: { borderColor: palette.border, borderRadius: 8, borderWidth: 1, minHeight: 36, justifyContent: "center", paddingHorizontal: 10 }, actionText: { color: palette.ink, fontSize: 11, fontWeight: "700" }, pagination: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 16 }, pageButton: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 8, borderWidth: 1, minHeight: 38, justifyContent: "center", paddingHorizontal: 12 }, pageText: { color: palette.ink, fontSize: 11, fontWeight: "700" }, disabled: { opacity: 0.4 },
  auditCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 14 }, auditTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, auditAction: { color: palette.ink, flex: 1, fontSize: 12, fontWeight: "800", textTransform: "capitalize" }, auditDate: { color: palette.muted, fontSize: 10, marginLeft: 8 }, auditDetail: { color: palette.muted, fontSize: 10, marginTop: 8 }, auditReason: { color: palette.ink, fontSize: 11, marginTop: 6 }, empty: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 12, padding: 22 },
  recordCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 12, borderWidth: 1, marginTop: 10, padding: 14 }, recordHeading: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" }, recordTitle: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: "800" }, recordBadge: { color: palette.green, fontSize: 9, fontWeight: "800", textTransform: "uppercase" }, recordDetail: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, dateFilter: { flex: 1 }, inlineActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }, inlineInput: { borderColor: palette.border, borderRadius: 9, borderWidth: 1, color: palette.ink, marginTop: 9, minHeight: 42, paddingHorizontal: 10, paddingVertical: 8 }, moduleMessage: { color: palette.green, fontSize: 12, marginTop: 8 }, selectedAction: { backgroundColor: "#EAF3EF", borderColor: palette.green },
  center: { alignItems: "center", flex: 1, gap: 10, justifyContent: "center", padding: 28 }, modalShade: { alignItems: "center", backgroundColor: "rgba(16,26,36,0.55)", flex: 1, justifyContent: "center", padding: 20 }, modalCard: { backgroundColor: palette.surface, borderRadius: 16, maxWidth: 460, padding: 20, width: "100%" }, modalTitle: { color: palette.ink, fontSize: 18, fontWeight: "800" }, modalDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }, reasonInput: { borderColor: palette.border, borderRadius: 10, borderWidth: 1, color: palette.ink, marginTop: 14, minHeight: 90, padding: 11, textAlignVertical: "top" }, modalButtons: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 }, cancelButton: { borderColor: palette.border, borderRadius: 9, borderWidth: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 15 }, cancelText: { color: palette.ink, fontSize: 12, fontWeight: "700" }, confirmButton: { alignItems: "center", backgroundColor: palette.green, borderRadius: 9, justifyContent: "center", minHeight: 42, minWidth: 92, paddingHorizontal: 15 }, confirmText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
});
