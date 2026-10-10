import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import {
  requestRegistrationOtp,
  saveAuthSession,
  verifyRegistrationOtp,
} from "@/components/backendApi";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (message: string, duration = 2200) => {
    setToast(message);
    setTimeout(() => setToast(""), duration);
  };

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      showToast("Fill all fields");
      return;
    }

    try {
      setIsSubmitting(true);

      if (!registrationId) {
        const result = await requestRegistrationOtp({
          email,
          fullName,
          password,
          phoneNumber,
        });

        setRegistrationId(result.registrationId);
        if (result.otp) {
          setOtp(result.otp);
          showToast(`Testing OTP: ${result.otp}`, 30000);
        } else {
          showToast("OTP sent. Enter the code to continue.");
        }
        return;
      }

      if (!otp.trim()) {
        showToast("Enter your OTP");
        return;
      }

      const auth = await verifyRegistrationOtp({ otp, registrationId });
      await saveAuthSession(auth);
      showToast("Account created");
      setTimeout(() => router.replace("/dashboard"), 500);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Sign up failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialSignup = (provider: string) => {
    showToast(`${provider} sign up is not connected yet`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={18} color="#C23122" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Use email or continue with a social account.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="#A69A95"
              style={styles.input}
              value={fullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#A69A95"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              autoComplete="tel"
              keyboardType="phone-pad"
              onChangeText={setPhoneNumber}
              placeholder="+233 55 000 0000"
              placeholderTextColor="#A69A95"
              style={styles.input}
              value={phoneNumber}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="Create password"
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
                  size={17}
                  color="#8B7F7A"
                />
              </TouchableOpacity>
            </View>
          </View>

          {registrationId ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>OTP code</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setOtp}
                placeholder="6-digit code"
                placeholderTextColor="#A69A95"
                style={styles.input}
                value={otp}
              />
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={isSubmitting}
            onPress={handleSignup}
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting
                ? "Please wait..."
                : registrationId
                ? "Verify OTP"
                : "Create account"}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleSocialSignup("Google")}
              style={styles.socialButton}
            >
              <FontAwesome6 name="google" size={18} color="#DB4437" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleSocialSignup("Facebook")}
              style={styles.socialButton}
            >
              <FontAwesome6 name="facebook-f" size={18} color="#1877F2" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => handleSocialSignup("Instagram")}
              style={styles.socialButton}
            >
              <FontAwesome6 name="instagram" size={18} color="#C13584" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text style={styles.footerLink}> Log in</Text>
          </TouchableOpacity>
        </View>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F2",
  },

  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
  },

  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  header: {
    marginTop: 34,
  },

  title: {
    color: "#261D1A",
    fontFamily: "PoppinsBold",
    fontSize: 34,
    lineHeight: 40,
  },

  subtitle: {
    color: "#6C625F",
    fontFamily: "RobotoSlabRegular",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },

  form: {
    marginTop: 30,
  },

  inputGroup: {
    marginBottom: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 15,
  },

  passwordInputWrap: {
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
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 15,
  },

  eyeButton: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 52,
  },

  primaryButton: {
    alignItems: "center",
    backgroundColor: "#C23122",
    borderRadius: 16,
    marginTop: 8,
    paddingVertical: 16,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 16,
  },

  disabledButton: {
    opacity: 0.72,
  },

  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginVertical: 22,
  },

  divider: {
    backgroundColor: "#E8DCD8",
    flex: 1,
    height: 1,
  },

  dividerText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 13,
  },

  socialRow: {
    flexDirection: "row",
    gap: 12,
  },

  socialButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#ECE1DD",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    height: 52,
    justifyContent: "center",
  },

  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: "auto",
  },

  footerText: {
    color: "#6C625F",
    fontFamily: "PoppinsRegular",
    fontSize: 14,
  },

  footerLink: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  toast: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#261D1A",
    borderRadius: 14,
    bottom: 82,
    maxWidth: "100%",
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: "absolute",
  },

  toastText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    textAlign: "center",
  },
});
