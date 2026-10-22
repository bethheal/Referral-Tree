import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  getProfile,
  logoutSession,
  updateProfile,
  type ProfileResponse,
} from "@/components/backendApi";

const C = {
  bg: "#FFFFFF", card: "#FFFFFF", text: "#192536", muted: "#8B7F7A",
  border: "#E7DDD9", primary: "#FFB900", soft: "#FFF4CC", danger: "#D92D20",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const isoDate = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
const parseDate = (value: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;
const maxBirthDate = () => {
  const now = new Date();
  const year = now.getUTCFullYear() - 18;
  const month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
};

export default function Profile() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [dob, setDob] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => {
    const date = maxBirthDate();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  });
  const [termsOpen, setTermsOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getProfile();
      setProfile(data);
      setName(data.fullName);
      setDob(data.dateOfBirth);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(pickerMonth.getUTCFullYear(), pickerMonth.getUTCMonth(), 1)).getUTCDay();
    const monthLength = new Date(Date.UTC(pickerMonth.getUTCFullYear(), pickerMonth.getUTCMonth() + 1, 0)).getUTCDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: monthLength }, (_, i) => i + 1)];
  }, [pickerMonth]);

  const save = async () => {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 120) {
      setError("Enter a name between 2 and 120 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const patch: { fullName: string; dateOfBirth?: string } = { fullName: normalized };
      if (dob) patch.dateOfBirth = dob;
      const updated = await updateProfile(patch);
      setProfile(updated);
      setName(updated.fullName);
      setDob(updated.dateOfBirth);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      await logoutSession();
      router.replace("/auth/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't sign out. Check your connection and retry.");
    } finally {
      setLoggingOut(false);
    }
  };

  const openPicker = () => {
    const initial = parseDate(dob) ?? maxBirthDate();
    setPickerMonth(new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth(), 1)));
    setPickerOpen(true);
  };

  const changeMonth = (delta: number) => setPickerMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
  const latest = maxBirthDate();
  const canNextMonth = pickerMonth.getTime() < Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={C.primary} /><Text style={styles.muted}>Loading profile…</Text></SafeAreaView>;
  if (!profile) return <SafeAreaView style={styles.center}><Text style={styles.title}>Profile unavailable</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void loadProfile()} style={styles.button}><Text style={styles.buttonText}>Retry</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Log out" disabled={loggingOut} onPress={() => void logout()}>
            <Text style={[styles.logout, loggingOut && styles.dimmed]}>{loggingOut ? "Signing out…" : "Log out"}</Text>
          </Pressable>
        </View>

        <View style={styles.identity}>
          {profile.profileImageUrl ? <Image source={{ uri: profile.profileImageUrl }} style={styles.avatar} /> : <View style={styles.avatar}><Ionicons name="person" size={34} color={C.text} /></View>}
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.tier}>{profile.membershipTier[0].toUpperCase() + profile.membershipTier.slice(1)} Member</Text>
          <Pressable accessibilityRole="button" onPress={() => { setName(profile.fullName); setDob(profile.dateOfBirth); setError(""); setEditing(true); }} style={styles.editButton}>
            <Ionicons name="create-outline" size={15} color={C.text} /><Text style={styles.editButtonText}>Edit profile</Text>
          </Pressable>
        </View>

        {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.detailCard}>
          <Detail label="Email" value={profile.email} />
          <Detail label="Phone" value={profile.phoneNumber ?? "Not provided"} last />
        </View>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.detailCard}>
          <Setting icon="receipt-outline" label="Orders" onPress={() => router.push("/dashboard/orders" as never)} />
          <Setting icon="notifications-outline" label="Notifications" onPress={() => router.push("/dashboard/notification" as never)} />
          <Setting icon="alert-circle-outline" label="Terms & Conditions" last onPress={() => setTermsOpen(true)} />
        </View>
        <Text style={styles.note}>Profile photos and phone number changes are unavailable until secure storage and phone verification are configured.</Text>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.overlay}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit profile</Text>
          <Text style={styles.label}>Full name</Text>
          <TextInput autoCapitalize="words" maxLength={120} onChangeText={setName} placeholder="Full name" style={styles.input} value={name} />
          <Text style={styles.label}>Date of birth (18+)</Text>
          <Pressable accessibilityRole="button" onPress={openPicker} style={styles.input}><Text style={dob ? styles.inputText : styles.placeholder}>{dob ?? "Choose date"}</Text></Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable disabled={saving} onPress={() => setEditing(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.dimmed]}>{saving ? <ActivityIndicator color="#192536" /> : <Text style={styles.buttonText}>Save</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.overlay}><View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.calendarArrow}><Ionicons name="chevron-back" size={19} color={C.text} /></Pressable>
            <Text style={styles.calendarTitle}>{MONTHS[pickerMonth.getUTCMonth()]} {pickerMonth.getUTCFullYear()}</Text>
            <Pressable accessibilityLabel="Next month" disabled={!canNextMonth} onPress={() => changeMonth(1)} style={styles.calendarArrow}><Ionicons name="chevron-forward" size={19} color={canNextMonth ? C.text : C.border} /></Pressable>
          </View>
          <View style={styles.daysGrid}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.daysGrid}>{calendarDays.map((day, index) => {
            if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const candidate = new Date(Date.UTC(pickerMonth.getUTCFullYear(), pickerMonth.getUTCMonth(), day));
            const disabled = candidate > latest;
            const selected = isoDate(candidate) === dob;
            return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${MONTHS[pickerMonth.getUTCMonth()]} ${day}, ${pickerMonth.getUTCFullYear()}`} disabled={disabled} onPress={() => { setDob(isoDate(candidate)); setPickerOpen(false); }} style={[styles.dayCell, selected && styles.selectedDay, disabled && styles.dimmed]}><Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text></Pressable>;
          })}</View>
          <Pressable onPress={() => setPickerOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={termsOpen} transparent animationType="fade" onRequestClose={() => setTermsOpen(false)}>
        <Pressable onPress={() => setTermsOpen(false)} style={styles.overlay}><Pressable onPress={() => undefined} style={styles.modalCard}><Text style={styles.modalTitle}>Terms & Conditions</Text><Text style={styles.muted}>Approved terms have not been configured for this app. Please contact Angel Foods for the current approved document.</Text><Pressable accessibilityRole="button" onPress={() => setTermsOpen(false)} style={styles.button}><Text style={styles.buttonText}>Close</Text></Pressable></Pressable></Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Detail({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.detailRow, !last && styles.rowBorder]}><Text style={styles.muted}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View>;
}

function Setting({ icon, label, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.settingRow, !last && styles.rowBorder]}><Ionicons name={icon} size={19} color={C.text} /><Text style={styles.settingLabel}>{label}</Text><Ionicons name="chevron-forward" size={17} color={C.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: C.bg, flex: 1 }, content: { padding: 20, paddingBottom: 50 }, center: { alignItems: "center", backgroundColor: C.bg, flex: 1, justifyContent: "center", padding: 24, rowGap: 12 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 24, marginTop: 16 }, title: { color: C.text, fontFamily: "PoppinsBold", fontSize: 20 }, logout: { color: C.danger, fontFamily: "PoppinsBold", fontSize: 12 }, dimmed: { opacity: 0.45 },
  identity: { alignItems: "center", marginBottom: 26 }, avatar: { alignItems: "center", backgroundColor: C.soft, borderColor: C.border, borderRadius: 48, borderWidth: 2, height: 88, justifyContent: "center", width: 88 }, name: { color: C.text, fontFamily: "PoppinsBold", fontSize: 17, marginTop: 12 }, tier: { color: "#806000", fontFamily: "PoppinsBold", fontSize: 11, marginTop: 3 }, editButton: { alignItems: "center", backgroundColor: C.soft, borderRadius: 20, flexDirection: "row", gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 8 }, editButtonText: { color: C.text, fontFamily: "PoppinsBold", fontSize: 11 },
  sectionTitle: { color: C.text, fontFamily: "PoppinsBold", fontSize: 13, marginBottom: 9, marginTop: 22 }, detailCard: { backgroundColor: C.card, borderColor: C.border, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 }, detailRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 53 }, rowBorder: { borderBottomColor: C.border, borderBottomWidth: StyleSheet.hairlineWidth }, muted: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 11 }, detailValue: { color: C.text, flexShrink: 1, fontFamily: "PoppinsRegular", fontSize: 11, marginLeft: 12, textAlign: "right" }, settingRow: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 }, settingLabel: { color: C.text, flex: 1, fontFamily: "PoppinsRegular", fontSize: 12 }, note: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 10, lineHeight: 16, marginTop: 20 },
  overlay: { alignItems: "center", backgroundColor: "rgba(10,20,30,0.42)", flex: 1, justifyContent: "center", padding: 20 }, modalCard: { backgroundColor: C.card, borderRadius: 20, gap: 10, maxWidth: 440, padding: 22, width: "100%" }, modalTitle: { color: C.text, fontFamily: "PoppinsBold", fontSize: 17, marginBottom: 8 }, label: { color: C.text, fontFamily: "PoppinsBold", fontSize: 11, marginTop: 5 }, input: { borderColor: C.border, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 13 }, inputText: { color: C.text, fontFamily: "PoppinsRegular", fontSize: 12 }, placeholder: { color: C.muted, fontFamily: "PoppinsRegular", fontSize: 12 }, actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 15 }, button: { alignItems: "center", backgroundColor: C.primary, borderRadius: 12, justifyContent: "center", minHeight: 44, minWidth: 95, paddingHorizontal: 20 }, buttonText: { color: C.text, fontFamily: "PoppinsBold", fontSize: 12 }, secondaryButton: { alignItems: "center", borderColor: C.border, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 95, paddingHorizontal: 16 }, secondaryText: { color: C.text, fontFamily: "PoppinsBold", fontSize: 12 }, errorBox: { backgroundColor: "#FFF0EE", borderRadius: 12, marginBottom: 12, padding: 12 }, errorText: { color: C.danger, fontFamily: "PoppinsRegular", fontSize: 11 },
  calendar: { backgroundColor: C.card, borderRadius: 18, maxWidth: 360, padding: 16, width: "100%" }, calendarHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }, calendarArrow: { alignItems: "center", height: 40, justifyContent: "center", width: 40 }, calendarTitle: { color: C.text, fontFamily: "PoppinsBold", fontSize: 13 }, daysGrid: { flexDirection: "row", flexWrap: "wrap" }, weekday: { color: C.muted, fontFamily: "PoppinsBold", fontSize: 10, textAlign: "center", width: "14.2857%" }, dayCell: { alignItems: "center", borderRadius: 22, height: 40, justifyContent: "center", width: "14.2857%" }, dayText: { color: C.text, fontFamily: "PoppinsRegular", fontSize: 11 }, selectedDay: { backgroundColor: C.primary }, selectedDayText: { fontFamily: "PoppinsBold" },
});
