import {
  backendAuthorizationRequirements,
  loginAdminAccount,
} from "@/components/adminAccess";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage("Enter your admin email and password.");
      return;
    }

    setIsLoading(true);
    const result = await loginAdminAccount(email, password);
    setIsLoading(false);
    setMessage(result.message);

    if (result.ok) {
      router.replace("/admin" as any);
    }
  };

  const handleForgotPassword = () => {
    setMessage("Password reset must be handled by the backend admin system.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.replace("/dashboard/profile" as any)}
            style={styles.backButton}
          >
            <FontAwesome6 name="arrow-left" size={16} color="#261D1A" />
          </TouchableOpacity>

          <View style={styles.brandBadge}>
            <FontAwesome6 name="shield-halved" size={22} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Admin Login</Text>
          <Text style={styles.subtitle}>
            Authorized Angel Foods staff only. Admin rights are verified before
            dashboard access.
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="admin@angelfoods.com"
                placeholderTextColor="#A69A95"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#A69A95"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eyeButton}
                >
                  <FontAwesome6
                    name={showPassword ? "eye-slash" : "eye"}
                    size={16}
                    color="#8B7F7A"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleForgotPassword}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleLogin}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? "Checking..." : "Login"}
              </Text>
            </TouchableOpacity>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={styles.securityPanel}>
            <Text style={styles.securityTitle}>Backend protection required</Text>
            {backendAuthorizationRequirements.map((item) => (
              <View key={item} style={styles.securityRow}>
                <FontAwesome6 name="lock" size={10} color="#C23122" />
                <Text style={styles.securityText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF8F2",
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    padding: 24,
  },

  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  brandBadge: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginTop: 38,
    width: 48,
  },

  title: {
    color: "#261D1A",
    fontFamily: "PoppinsBold",
    fontSize: 34,
    marginTop: 18,
  },

  subtitle: {
    color: "#6C625F",
    fontFamily: "RobotoSlabRegular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  form: {
    marginTop: 30,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: "#443B38",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#ECE1DD",
    borderRadius: 16,
    borderWidth: 1,
    color: "#261D1A",
    fontFamily: "PoppinsRegular",
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },

  passwordWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#ECE1DD",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
  },

  passwordInput: {
    color: "#261D1A",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 16,
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 8,
  },

  eyeButton: {
    alignItems: "center",
    height: 54,
    justifyContent: "center",
    width: 52,
  },

  forgotButton: {
    alignSelf: "flex-end",
  },

  forgotText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  loginButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 16,
    marginTop: 22,
    minHeight: 54,
    justifyContent: "center",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  message: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },

  securityPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F0D6D0",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 28,
    padding: 14,
  },

  securityTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginBottom: 9,
  },

  securityRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: 7,
  },

  securityText: {
    color: "#6C625F",
    flex: 1,
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    lineHeight: 15,
  },
});
