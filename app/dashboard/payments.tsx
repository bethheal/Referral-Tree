import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

type CardType = "Visa" | "Mastercard";
type PaymentMethod = {
  brandColor: string;
  icon: string;
  id: string;
  label: string;
};
type PaymentStep = "select" | "add-card" | "processing" | "success";

const defaultMethods: PaymentMethod[] = [
  {
    brandColor: "#1B75BB",
    icon: "paypal",
    id: "paypal",
    label: "PayPal",
  },
  {
    brandColor: "#EB001B",
    icon: "cc-mastercard",
    id: "mastercard",
    label: "Mastercard",
  },
  {
    brandColor: "#1A1F71",
    icon: "cc-visa",
    id: "visa",
    label: "Visa",
  },
  {
    brandColor: "#F6A800",
    icon: "mobile-screen-button",
    id: "momo",
    label: "MTN Mobile Money",
  },
];

const cardTypes: CardType[] = ["Visa", "Mastercard"];

const getLastDigits = (value: string) => {
  const digits = value.replace(/\D/g, "");

  return digits.slice(-4) || "0257";
};

const formatCardNumber = (value: string) =>
  value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

const onlyNumbers = (value: string, maxLength: number) =>
  value.replace(/\D/g, "").slice(0, maxLength);

export default function Payments() {
  const { width } = useWindowDimensions();
  const successScale = useRef(new Animated.Value(0.72)).current;
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accountHolder, setAccountHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardType, setCardType] = useState<CardType>("Visa");
  const [cvv, setCvv] = useState("");
  const [expiry, setExpiry] = useState("");
  const [methods, setMethods] = useState(defaultMethods);
  const [saveCard, setSaveCard] = useState(true);
  const [selectedMethodId, setSelectedMethodId] = useState("visa");
  const [step, setStep] = useState<PaymentStep>("select");

  const cardDigits = cardNumber.replace(/\D/g, "");
  const expiryDigits = expiry.replace(/\D/g, "");
  const canSaveCard =
    cardDigits.length === 16 &&
    accountHolder.trim().length > 1 &&
    expiryDigits.length === 4 &&
    cvv.length === 3;
  const pageMaxWidth = Math.min(width - 36, 330);

  useEffect(
    () => () => {
      if (processingTimer.current) {
        clearTimeout(processingTimer.current);
      }
    },
    []
  );

  const startProcessing = () => {
    setStep("processing");
    successScale.setValue(0.72);

    processingTimer.current = setTimeout(() => {
      setStep("success");
      Animated.spring(successScale, {
        friction: 5,
        tension: 130,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }, 1400);
  };

  const addCard = () => {
    if (!canSaveCard) return;

    const lastDigits = getLastDigits(cardNumber);
    const method: PaymentMethod = {
      brandColor: cardType === "Visa" ? "#1A1F71" : "#EB001B",
      icon: cardType === "Visa" ? "cc-visa" : "cc-mastercard",
      id: `${cardType.toLowerCase()}-${lastDigits}-${Date.now()}`,
      label: `${cardType} ${lastDigits}`,
    };

    if (saveCard) {
      setMethods((current) => [method, ...current]);
      setSelectedMethodId(method.id);
    }

    startProcessing();
  };

  const removeMethod = (methodId: string) => {
    setMethods((current) => {
      const nextMethods = current.filter((method) => method.id !== methodId);

      if (selectedMethodId === methodId) {
        setSelectedMethodId(nextMethods[0]?.id ?? "");
      }

      return nextMethods;
    });
  };

  const goBack = () => {
    if (step === "add-card") {
      setStep("select");
      return;
    }

    router.back();
  };

  if (step === "success") {
    return (
      <SafeAreaView style={styles.successContainer}>
        <View style={[styles.successScreen, { maxWidth: pageMaxWidth }]}>
          <Text style={styles.successHeadline}>Payment Successful!</Text>

          <Animated.View
            style={[styles.successMark, { transform: [{ scale: successScale }] }]}
          >
            <FontAwesome6 name="check" size={42} color="#FFFFFF" />
          </Animated.View>

          <Text style={styles.successMessage}>
            Thank you for using our service, your payment is on its way to the
            receiver!
          </Text>

          <View style={styles.successActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setStep("select")}
              style={styles.secondarySuccessButton}
            >
              <Text style={styles.secondarySuccessText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.replace("/dashboard/products" as any)}
              style={styles.primarySuccessButton}
            >
              <Text style={styles.primarySuccessText}>Continue shopping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push("/dashboard/orders" as any)}
              style={styles.secondarySuccessButton}
            >
              <Text style={styles.secondarySuccessText}>Go to orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContent}>
        <View style={[styles.phoneCard, { maxWidth: pageMaxWidth }]}>
          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={goBack}
              style={styles.backButton}
            >
              <FontAwesome6 name="arrow-left" size={14} color="#1E3631" />
            </TouchableOpacity>

            <Text style={styles.title}>
              {step === "add-card" ? "Add New Card" : "Payment"}
            </Text>
          </View>

          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((item) => (
              <View
                key={item}
                style={[
                  styles.progressSegment,
                  item <= (step === "select" ? 1 : 2) && styles.activeSegment,
                ]}
              />
            ))}
          </View>

          {step === "processing" ? (
            <View style={styles.processingState}>
              <ActivityIndicator color="#FF5A00" size="large" />

              <Text style={styles.processingTitle}>Processing payment</Text>

              <Text style={styles.processingText}>
                This will only take a moment.
              </Text>
            </View>
          ) : null}

          {step === "select" ? (
            <View style={styles.selectBody}>
              <Text style={styles.sectionLabel}>Select Payment Method</Text>

              <View style={styles.methodList}>
                {methods.map((method) => {
                  const isSelected = selectedMethodId === method.id;
                  const canRemove = !["paypal", "mastercard", "visa", "momo"].includes(
                    method.id
                  );

                  return (
                    <Pressable
                      key={method.id}
                      onPress={() => setSelectedMethodId(method.id)}
                      style={[styles.methodRow, isSelected && styles.selectedMethodRow]}
                    >
                      <View style={styles.methodBrand}>
                        <FontAwesome6
                          name={method.icon as any}
                          size={22}
                          color={method.brandColor}
                        />
                      </View>

                      <Text style={styles.methodName}>{method.label}</Text>

                      {canRemove ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            removeMethod(method.id);
                          }}
                          style={styles.removeButton}
                        >
                          <FontAwesome6 name="trash" size={10} color="#C23122" />
                        </Pressable>
                      ) : null}

                      <View style={[styles.radioBox, isSelected && styles.selectedRadio]}>
                        {isSelected ? (
                          <FontAwesome6 name="check" size={10} color="#FF5A00" />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setStep("add-card")}
                style={styles.addNewCardButton}
              >
                <FontAwesome6 name="plus" size={11} color="#1E3631" />

                <Text style={styles.addNewCardText}>Add New Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!selectedMethodId}
                onPress={startProcessing}
                style={[
                  styles.bottomButton,
                  !selectedMethodId && styles.disabledButton,
                ]}
              >
                <Text style={styles.bottomButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {step === "add-card" ? (
            <View style={styles.cardBody}>
              <View style={styles.cardPreview}>
                <View style={styles.cardStripe} />
                <View style={styles.cardCurveOne} />
                <View style={styles.cardCurveTwo} />

                <View style={styles.cardPreviewBottom}>
                  <View>
                    <Text style={styles.cardTinyLabel}>Card Number</Text>
                    <Text style={styles.cardMaskedNumber}>
                      {cardDigits.length >= 4
                        ? `**** **** **** ${getLastDigits(cardNumber)}`
                        : "**** **** **** 0000"}
                    </Text>

                    <Text style={styles.cardTinyLabel}>Expiry date</Text>
                    <Text style={styles.cardMaskedNumber}>{expiry || "06/20"}</Text>
                  </View>

                  <View style={styles.cardChip} />
                </View>
              </View>

              <Text style={styles.formTitle}>Card Details</Text>

              <View style={styles.typeRow}>
                {cardTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.86}
                    onPress={() => setCardType(type)}
                    style={[styles.typePill, cardType === type && styles.activeTypePill]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        cardType === type && styles.activeTypePillText,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Card number</Text>
              <TextInput
                keyboardType="number-pad"
                placeholder="0000 0000 0000 0000"
                placeholderTextColor="#B9AAA4"
                value={cardNumber}
                maxLength={19}
                onChangeText={(value) => setCardNumber(formatCardNumber(value))}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Account Holder</Text>
              <TextInput
                placeholder="Name on card"
                placeholderTextColor="#B9AAA4"
                value={accountHolder}
                onChangeText={setAccountHolder}
                style={styles.input}
              />

              <View style={styles.splitInputRow}>
                <View style={styles.splitInput}>
                  <Text style={styles.inputLabel}>Expiry Number</Text>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="06/28"
                    placeholderTextColor="#B9AAA4"
                    value={expiry}
                    maxLength={5}
                    onChangeText={(value) => setExpiry(formatExpiry(value))}
                    style={styles.input}
                  />
                </View>

                <View style={styles.splitInput}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    keyboardType="number-pad"
                    placeholder="123"
                    placeholderTextColor="#B9AAA4"
                    secureTextEntry
                    maxLength={3}
                    value={cvv}
                    onChangeText={(value) => setCvv(onlyNumbers(value, 3))}
                    style={styles.input}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => setSaveCard((current) => !current)}
                style={styles.saveRow}
              >
                <View style={[styles.checkbox, saveCard && styles.checkedBox]}>
                  {saveCard ? (
                    <FontAwesome6 name="check" size={10} color="#FFFFFF" />
                  ) : null}
                </View>

                <Text style={styles.saveText}>Save card information</Text>
              </Pressable>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!canSaveCard}
                onPress={addCard}
                style={[styles.bottomButton, !canSaveCard && styles.disabledButton]}
              >
                <Text style={styles.bottomButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F4F2F0",
    flex: 1,
  },

  screenContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },

  phoneCard: {
    height: 620,
    padding: 18,
    width: "100%",
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },

  backButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },

  title: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 14,
  },

  progressRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 18,
  },

  progressSegment: {
    backgroundColor: "#D3D0CD",
    flex: 1,
    height: 2,
  },

  activeSegment: {
    backgroundColor: "#FF5A00",
  },

  selectBody: {
    flex: 1,
    paddingTop: 30,
  },

  sectionLabel: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginBottom: 14,
  },

  methodList: {
    gap: 9,
  },

  methodRow: {
    alignItems: "center",
    borderColor: "#EFEAE6",
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 45,
    paddingHorizontal: 10,
  },

  selectedMethodRow: {
    borderColor: "#FF5A00",
  },

  methodBrand: {
    alignItems: "center",
    width: 34,
  },

  methodName: {
    color: "#1E3631",
    flex: 1,
    fontFamily: "PoppinsBold",
    fontSize: 12,
    marginLeft: 10,
  },

  radioBox: {
    alignItems: "center",
    borderColor: "#E2DEDA",
    borderRadius: 4,
    borderWidth: 1,
    height: 17,
    justifyContent: "center",
    width: 17,
  },

  selectedRadio: {
    borderColor: "#FF5A00",
  },

  removeButton: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    marginRight: 6,
    width: 24,
  },

  addNewCardButton: {
    alignItems: "center",
    backgroundColor: "#F6F5F4",
    borderRadius: 6,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 38,
  },

  addNewCardText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  bottomButton: {
    alignItems: "center",
    backgroundColor: "#FF5A00",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: "auto",
    minHeight: 44,
  },

  activeButton: {
    backgroundColor: "#FF5A00",
  },

  disabledButton: {
    backgroundColor: "#D8CDC7",
  },

  bottomButtonText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  cardBody: {
    flex: 1,
    paddingTop: 34,
  },

  cardPreview: {
    backgroundColor: "#F25408",
    borderRadius: 10,
    height: 136,
    justifyContent: "flex-end",
    overflow: "hidden",
    padding: 16,
  },

  cardStripe: {
    backgroundColor: "#A92D08",
    height: 16,
    left: 0,
    position: "absolute",
    right: 0,
    top: 10,
  },

  cardCurveOne: {
    borderColor: "rgba(255,184,42,0.35)",
    borderRadius: 90,
    borderWidth: 10,
    height: 170,
    position: "absolute",
    right: -45,
    top: -26,
    width: 120,
  },

  cardCurveTwo: {
    borderColor: "rgba(255,184,42,0.28)",
    borderRadius: 90,
    borderWidth: 8,
    height: 160,
    position: "absolute",
    right: -18,
    top: -26,
    width: 96,
  },

  cardPreviewBottom: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  cardTinyLabel: {
    color: "#FFE4D3",
    fontFamily: "PoppinsBold",
    fontSize: 8,
    marginTop: 8,
  },

  cardMaskedNumber: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 10,
    letterSpacing: 1,
  },

  cardChip: {
    backgroundColor: "#FFBD1A",
    borderRadius: 16,
    height: 31,
    width: 31,
  },

  formTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 13,
    marginTop: 18,
  },

  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  typePill: {
    borderColor: "#E8E2DE",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  activeTypePill: {
    backgroundColor: "#FFF1EF",
    borderColor: "#FF5A00",
  },

  typePillText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsBold",
    fontSize: 10,
  },

  activeTypePillText: {
    color: "#FF5A00",
  },

  inputLabel: {
    color: "#314640",
    fontFamily: "PoppinsRegular",
    fontSize: 10,
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    borderColor: "#BEB9B4",
    borderRadius: 5,
    borderWidth: 1,
    color: "#1E3631",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    height: 36,
    paddingHorizontal: 10,
  },

  splitInputRow: {
    flexDirection: "row",
    gap: 12,
  },

  splitInput: {
    flex: 1,
  },

  saveRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },

  checkbox: {
    alignItems: "center",
    borderColor: "#6D7670",
    borderRadius: 3,
    borderWidth: 1,
    height: 15,
    justifyContent: "center",
    width: 15,
  },

  checkedBox: {
    backgroundColor: "#6D7670",
  },

  saveText: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 11,
  },

  processingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },

  processingTitle: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 16,
    marginTop: 18,
  },

  processingText: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 12,
    marginTop: 5,
  },

  successContainer: {
    alignItems: "center",
    backgroundColor: "#F4F2F0",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },

  successScreen: {
    alignItems: "center",
    backgroundColor: "#FF5A00",
    borderRadius: 18,
    minHeight: 580,
    paddingHorizontal: 22,
    paddingVertical: 56,
    shadowColor: "#2F170F",
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    width: "100%",
    elevation: 8,
  },

  successHeadline: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 19,
    marginTop: 110,
  },

  successMark: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 40,
    borderWidth: 3,
    height: 70,
    justifyContent: "center",
    marginTop: 70,
    width: 70,
  },

  successMessage: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 42,
    maxWidth: 210,
    textAlign: "center",
  },

  successActions: {
    gap: 11,
    marginTop: "auto",
    width: "100%",
  },

  primarySuccessButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    justifyContent: "center",
    minHeight: 38,
  },

  primarySuccessText: {
    color: "#314640",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },

  secondarySuccessButton: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
  },

  secondarySuccessText: {
    color: "#FFFFFF",
    fontFamily: "PoppinsBold",
    fontSize: 12,
  },
});

