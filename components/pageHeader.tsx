import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <FontAwesome6
          name="arrow-left"
          size={17}
          color="#261D1A"
        />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>

        {subtitle ? (
          <Text style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 20,
    marginTop: 30,
  },

  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },

  titleContainer: {
    flex: 1,
    marginLeft: 14,
  },

  title: {
    color: "#1E3631",
    fontFamily: "PoppinsBold",
    fontSize: 20,
  },

  subtitle: {
    color: "#8B7F7A",
    fontFamily: "PoppinsRegular",
    fontSize: 11,
    marginTop: 2,
  },

  placeholder: {
    width: 44,
  },
});