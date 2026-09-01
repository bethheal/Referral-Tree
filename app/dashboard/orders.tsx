import PageHeader from "@/components/pageHeader";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Cart() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
<PageHeader
  title="My Orders"
  subtitle="Track your Angel Foods orders"
/>
        <Text>orders   will appear here.</Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F2",
  },

  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
});