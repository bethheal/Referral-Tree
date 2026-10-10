import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
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

const COLORS = {
  bg: "#FFF8F2", // matches the rest of the app
  card: "#FFFFFF",
  primary: "#4F7DF3", // change this to your brand color
  primarySoft: "#E8EEFE",
  text: "#111827",
  muted: "#8A8F98",
  border: "#F0EBE6",
  danger: "#EF4444",
  gold: "#F4D77A",
  goldDark: "#B8921F",
};

const AVATAR = "https://i.pravatar.cc/300?img=12"; // replace with user's photo

type SettingRow = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
};

const SETTINGS: SettingRow[] = [
  { icon: "receipt-outline", label: "Invoices & Orders" },
  { icon: "clipboard-outline", label: "Fatwa" },
  { icon: "language-outline", label: "Languages" },
  { icon: "scan-outline", label: "Face Id" },
  { icon: "notifications-outline", label: "Notification" },
  { icon: "sunny-outline", label: "Theme", value: "Light" },
  { icon: "alert-circle-outline", label: "Terms & Conditions" },
];

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [name, setName] = useState("Ryan Sterling");
  const [phone, setPhone] = useState("56455 2548");
  const [dob, setDob] = useState("3/16/1999");

  /* ---------------- EDIT PROFILE ---------------- */
  if (editing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screen}>
          <View style={styles.editHeader}>
            <Pressable style={styles.backBtn} onPress={() => setEditing(false)}>
              <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            </Pressable>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View style={styles.avatarWrap}>
              <Image source={{ uri: AVATAR }} style={styles.avatar} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera-outline" size={14} color={COLORS.primary} />
              </View>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={COLORS.muted}
            />

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.input}>
              <View style={styles.phoneRow}>
                <View style={styles.countryPill}>
                  <Text style={{ fontSize: 18 }}>🇸🇦</Text>
                  <Text style={styles.countryCode}>+966</Text>
                  <Ionicons name="chevron-down" size={14} color={COLORS.text} />
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={dob}
              onChangeText={setDob}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={COLORS.muted}
            />
          </ScrollView>

          <Pressable style={styles.primaryBtn} onPress={() => setShowSuccess(true)}>
            <Text style={styles.primaryBtnText}>Save Change</Text>
          </Pressable>
        </View>

        {/* SUCCESS MODAL */}
        <Modal transparent animationType="fade" visible={showSuccess}>
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <View style={styles.checkOuter}>
                <View style={styles.checkMiddle}>
                  <View style={styles.checkInner}>
                    <Ionicons name="checkmark" size={26} color="#fff" />
                  </View>
                </View>
              </View>

              <Text style={styles.modalTitle}>Profile Updated</Text>
              <Text style={styles.modalText}>
                Congratulations 🎉, your profile has been successfully updated.
                Enjoy your next order from Angel Foods.
              </Text>

              <Pressable
                style={[styles.primaryBtn, { alignSelf: "stretch", marginTop: 20 }]}
                onPress={() => {
                  setShowSuccess(false);
                  setEditing(false);
                }}
              >
                <Text style={styles.primaryBtnText}>Okay, Thanks</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  /* ---------------- PROFILE ---------------- */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* USER INFO */}
          <View style={styles.userBlock}>
            <Pressable style={styles.avatarWrap} onPress={() => setEditing(true)}>
              <Image source={{ uri: AVATAR }} style={styles.avatar} />
              <View style={styles.editChip}>
                <Ionicons name="create-outline" size={11} color={COLORS.primary} />
                <Text style={styles.editChipText}>Edit</Text>
              </View>
            </Pressable>

            <Text style={styles.name}>{name}</Text>
            <Text style={styles.idText}>ID No : 1105486242</Text>

            <View style={styles.memberBadge}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.goldDark} />
              <Text style={styles.memberText}>Standard Member</Text>
            </View>
          </View>

          {/* SETTINGS */}
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsCard}>
            {SETTINGS.map((item, i) => (
              <Pressable
                key={item.label}
                style={[
                  styles.row,
                  i !== SETTINGS.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={18} color={COLORS.text} />
                </View>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
                <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  screen: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },
  scrollContent: { paddingBottom: 120 },

  /* header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  logout: { fontSize: 14, fontWeight: "600", color: COLORS.danger },

  /* user block */
  userBlock: { alignItems: "center", marginBottom: 24 },
  avatarWrap: { alignSelf: "center", marginBottom: 16 },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: COLORS.border,
    borderWidth: 3,
    borderColor: "#fff",
  },
  editChip: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  editChipText: { fontSize: 10, color: COLORS.text, fontWeight: "500" },
  name: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  idText: { fontSize: 11, color: COLORS.muted, marginTop: 2, marginBottom: 10 },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  memberText: { fontSize: 11, fontWeight: "600", color: "#5A4510" },

  /* settings */
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 10,
  },
  settingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4F5F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: "500", color: COLORS.text },
  rowValue: { fontSize: 12, color: COLORS.muted, marginRight: 6 },

  /* edit profile */
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  editTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: "center",
    fontSize: 12,
    color: COLORS.text,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", marginLeft: -10 },
  countryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F3F7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 12,
  },
  countryCode: { fontSize: 12, fontWeight: "500", color: COLORS.text },
  phoneInput: { flex: 1, fontSize: 12, color: COLORS.text },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  /* success modal */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,248,242,0.75)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  checkOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#F1F5FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  checkMiddle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  checkInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalText: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 8,
  },
});