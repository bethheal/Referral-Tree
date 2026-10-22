import {
  backendAuthorizationRequirements,
  finishAdminMfaLogin,
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
  const [mfaStep, setMfaStep] = useState<"password" | "setup" | "verify" | "recovery">("password");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

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
    } else if (result.step === "setup" || result.step === "verify") {
      setMfaStep(result.step);
      if (result.step === "setup") setMfaSecret(result.secret);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaCode.trim()) {
      setMessage("Enter the six-digit authenticator code or a recovery code.");
      return;
    }
    setIsLoading(true);
    try {
      const { session, recoveryCodes } = await finishAdminMfaLogin(email.trim(), mfaCode.trim());
      if (mfaStep === "setup") {
        setRecoveryCodes(recoveryCodes);
        setMfaStep("recovery");
        setMessage("MFA is active. Save these recovery codes somewhere secure.");
        return;
      }
      setMessage(`Welcome, ${session.name}.`);
      router.replace("/admin" as any);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MFA verification failed.");
    } finally {
      setIsLoading(false);
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

          {mfaStep === "password" ? <View style={styles.form}>
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
          </View> : null}

          {mfaStep === "setup" || mfaStep === "verify" ? <View style={styles.form}>
            {mfaStep === "setup" ? <View style={styles.mfaPanel}>
              <Text style={styles.label}>Authenticator setup key</Text>
              <Text selectable style={styles.secret}>{mfaSecret}</Text>
              <Text style={styles.mfaHint}>Enter this key manually in an authenticator app, then enter the current six-digit code below.</Text>
            </View> : null}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{mfaStep === "setup" ? "Authenticator code" : "Authenticator or recovery code"}</Text>
              <TextInput
                autoCapitalize="characters"
                autoComplete="one-time-code"
                keyboardType={mfaCode.includes("-") ? "default" : "number-pad"}
                onChangeText={setMfaCode}
                placeholder={mfaStep === "setup" ? "123456" : "Enter your code"}
                placeholderTextColor="#A69A95"
                style={styles.input}
                value={mfaCode}
              />
            </View>
            <TouchableOpacity activeOpacity={0.86} disabled={isLoading} onPress={() => void handleVerifyMfa()} style={styles.loginButton}>
              <Text style={styles.loginButtonText}>{isLoading ? "Verifying..." : "Verify MFA"}</Text>
            </TouchableOpacity>
          </View> : null}

          {mfaStep === "recovery" ? <View style={styles.form}>
            <View style={styles.mfaPanel}>
              <Text style={styles.label}>One-time recovery codes</Text>
              {recoveryCodes.map((code) => <Text selectable key={code} style={styles.secret}>{code}</Text>)}
              <Text style={styles.mfaHint}>Each code can only be used once. Store them securely; they will not be shown again.</Text>
            </View>
            <TouchableOpacity activeOpacity={0.86} onPress={() => router.replace("/admin" as any)} style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Continue to dashboard</Text>
            </TouchableOpacity>
          </View> : null}

          <View style={styles.securityPanel}>
            <Text style={styles.securityTitle}>Backend protection required</Text>
            {backendAuthorizationRequirements.map((item) => (
              <View key={item} style={styles.securityRow}>
                <FontAwesome6 name="lock" size={10} color="#192536" />
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#192536",
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
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  loginButton: {
    alignItems: "center",
    backgroundColor: "#192536",
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
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },

  mfaPanel: {
    backgroundColor: "#F7F8FA",
    borderColor: "#D9DEE6",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },

  secret: {
    color: "#192536",
    fontFamily: "PoppinsBold",
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 5,
  },

  mfaHint: {
    color: "#6C625F",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
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
