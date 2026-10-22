import { Redirect } from "expo-router";

/** Preserve old links while routing all admin access through the guarded admin area. */
export default function LegacyAdminRoute() {
  return <Redirect href="/admin" />;
}
