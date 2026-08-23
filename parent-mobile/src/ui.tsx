import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  background: "#eef1fb",
  surface: "#ffffff",
  text: "#1f2b3a",
  muted: "#718096",
  border: "#e2e8f0",
  blue: "#2563eb",
  blueSoft: "#e8f0ff",
  mint: "#2fbfa6",
  mintSoft: "#d8f5ee",
  warning: "#e88a2f",
  danger: "#e44658",
};

export function Screen({ children, scroll = false, refreshControl }: { children: React.ReactNode; scroll?: boolean; refreshControl?: React.ReactElement }) {
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={refreshControl}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled = false, loading = false }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}><Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}

export function Field({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor="#94a3b8" {...props} style={[styles.field, style]} />;
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screenContent: { flex: 1, padding: 20, gap: 16 },
  scrollContent: { flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,.9)", borderRadius: 20, padding: 18, shadowColor: "#64748b", shadowOpacity: .10, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  primaryButton: { minHeight: 52, borderRadius: 15, backgroundColor: colors.blue, justifyContent: "center", alignItems: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#c9d8fb", backgroundColor: colors.blueSoft, justifyContent: "center", alignItems: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: colors.blue, fontSize: 15, fontWeight: "700" },
  buttonDisabled: { opacity: .55 },
  buttonPressed: { opacity: .82, transform: [{ scale: .99 }] },
  field: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
