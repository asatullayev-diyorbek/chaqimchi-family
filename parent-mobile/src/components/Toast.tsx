import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadow } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./primitives";

type ToastKind = "success" | "error" | "info";
type ToastMsg = { id: number; text: string; kind: ToastKind };

const Ctx = createContext<{
  show: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback(
    (text: string, kind: ToastKind = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: ++seq.current, text, kind });
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => finished && setToast(null),
        );
      }, 3200);
    },
    [anim],
  );

  const value = React.useMemo(
    () => ({
      show,
      success: (t: string) => show(t, "success"),
      error: (t: string) => show(t, "error"),
    }),
    [show],
  );

  const tone =
    toast?.kind === "success"
      ? { c: colors.success, bg: colors.mintSoft, icon: "checkCircle" as const }
      : toast?.kind === "error"
        ? { c: colors.danger, bg: colors.dangerSoft, icon: "alert" as const }
        : { c: colors.blue, bg: colors.blueSoft, icon: "info" as const };

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <SafeAreaView style={styles.wrap} pointerEvents="none" edges={["top"]}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: tone.bg, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }], opacity: anim },
            ]}
          >
            <Icon name={tone.icon} size={17} color={tone.c} />
            <Text variant="label" color={colors.text} style={{ flex: 1 }}>
              {toast.text}
            </Text>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    ...shadow.card,
  },
});
