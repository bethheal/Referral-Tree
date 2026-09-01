import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
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

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");

  // --------------------------------
  // TOAST
  // --------------------------------

  const showToast = (message: string) => {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 2200);
  };

  // --------------------------------
  // LOGIN
  // --------------------------------

  const handleLogin = () => {
    if (!email.trim() || !password) {
      showToast("Fill all fields");
      return;
    }

    if (!email.includes("@") || password.length < 6) {
      showToast("Login failed. Check email or password");
      return;
    }

    showToast("Login successful");

    setTimeout(() => {
      router.replace("/dashboard");
    }, 700);
  };

  // --------------------------------
  // FORGOT PASSWORD
  // --------------------------------

  const handleForgotPassword = () => {
    if (!email.trim()) {
      showToast("Enter your email first");
      return;
    }

    showToast("Password reset link sent");
  };

  // --------------------------------
  // SOCIAL LOGIN
  // --------------------------------

  const handleSocialLogin = (provider: string) => {
    showToast(`${provider} login successful`);

    setTimeout(() => {
      router.replace("/dashboard");
    }, 700);
  };

  // --------------------------------
  // BACK
  // --------------------------------

  const handleBack = () => {
    router.replace("/auth");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        {/* BACK BUTTON */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <FontAwesome6
            name="arrow-left"
            size={18}
            color="#261D1A"
          />
        </TouchableOpacity>

        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.title}>
            Log in
          </Text>

          <Text style={styles.subtitle}>
            Use email or continue with a social account.
          </Text>
        </View>

        {/* FORM */}

        <View style={styles.form}>

          {/* EMAIL */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Email
            </Text>

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

          {/* PASSWORD */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Password
            </Text>

            <View style={styles.passwordInputWrap}>
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

              {/* SHOW / HIDE PASSWORD */}

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                style={styles.eyeButton}
              >
                <FontAwesome6
                  name={
                    showPassword
                      ? "eye-slash"
                      : "eye"
                  }
                  size={17}
                  color="#8B7F7A"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* FORGOT PASSWORD */}

          <TouchableOpacity
            activeOpacity={0.78}
            onPress={handleForgotPassword}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          {/* LOGIN */}

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleLogin}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Log in
            </Text>
          </TouchableOpacity>

          {/* DIVIDER */}

          <View style={styles.dividerRow}>
            <View style={styles.divider} />

            <Text style={styles.dividerText}>
              or
            </Text>

            <View style={styles.divider} />
          </View>

          {/* SOCIAL LOGIN */}

          <View style={styles.socialRow}>

            {/* GOOGLE */}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() =>
                handleSocialLogin("Google")
              }
              style={styles.socialButton}
            >
              <FontAwesome6
                name="google"
                size={18}
                color="#DB4437"
              />
            </TouchableOpacity>

            {/* FACEBOOK */}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() =>
                handleSocialLogin("Facebook")
              }
              style={styles.socialButton}
            >
              <FontAwesome6
                name="facebook-f"
                size={18}
                color="#1877F2"
              />
            </TouchableOpacity>

            {/* INSTAGRAM */}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() =>
                handleSocialLogin("Instagram")
              }
              style={styles.socialButton}
            >
              <FontAwesome6
                name="instagram"
                size={18}
                color="#C13584"
              />
            </TouchableOpacity>

          </View>
        </View>

        {/* FOOTER */}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            New to Angel Foods?
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.replace("/auth/signup")
            }
          >
            <Text style={styles.footerLink}>
              {" "}Create account
            </Text>
          </TouchableOpacity>
        </View>

        {/* TOAST */}

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>
              {toast}
            </Text>
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

  // --------------------------------
  // BACK BUTTON
  // --------------------------------

  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,

    elevation: 2,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // --------------------------------
  // HEADER
  // --------------------------------

  header: {
    marginTop: 42,
  },

  title: {
    color: "#261D1A",
    fontFamily: "PoppinsBold",
    fontSize: 36,
  },

  subtitle: {
    color: "#6C625F",
    fontFamily: "RobotoSlabRegular",
    fontSize: 15,
    marginTop: 8,
  },

  // --------------------------------
  // FORM
  // --------------------------------

  form: {
    marginTop: 34,
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
    paddingHorizontal: 16,
    paddingVertical: 15,
  },

  // --------------------------------
  // PASSWORD
  // --------------------------------

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

  // --------------------------------
  // FORGOT PASSWORD
  // --------------------------------

  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 18,
  },

  forgotText: {
    color: "#C23122",
    fontFamily: "PoppinsBold",
    fontSize: 13,
  },

  // --------------------------------
  // LOGIN BUTTON
  // --------------------------------

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

  // --------------------------------
  // DIVIDER
  // --------------------------------

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

  // --------------------------------
  // SOCIAL
  // --------------------------------

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

  // --------------------------------
  // FOOTER
  // --------------------------------

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

  // --------------------------------
  // TOAST
  // --------------------------------

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