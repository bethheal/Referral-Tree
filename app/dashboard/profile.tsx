
import DashboardBottomNav from "@/components/dashboardBottomNav";
import PageHeader from "@/components/pageHeader";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

export default function Products() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>

        {/* PAGE HEADER */}
        <PageHeader
          title="Products"
          subtitle="Browse Angel Foods products"
        />

        {/* PRODUCTS */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Products go here */}
        </ScrollView>

        {/* GLOBAL BOTTOM NAVIGATION */}
        <DashboardBottomNav activeLabel="Products" />

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

  scrollContent: {
    paddingBottom: 120,
  },
});

