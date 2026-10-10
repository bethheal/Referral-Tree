import {
  StyleSheet,
  Text,
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
      <View style={styles.menuSlot} />

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

  menuSlot: {
    height: 44,
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
