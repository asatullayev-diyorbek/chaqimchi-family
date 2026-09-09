import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "../theme";
import { Button, IconButton, Text } from "./primitives";

/**
 * Lightweight bottom sheet — RN Modal + Animated, no gesture library. Slides
 * up on open, fades the scrim, and animates out before unmounting so the
 * dismissal doesn't snap.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const [mounted, setMounted] = React.useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, mounted, anim]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [480, 0] });
  const Body = scroll ? ScrollView : View;

  return (
    <Modal transparent visible={mounted} onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Yopish" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <Text variant="h2">{title}</Text>
              <IconButton name="close" onPress={onClose} accessibilityLabel="Yopish" color={colors.muted} />
            </View>
          ) : null}
          <Body
            {...(scroll
              ? { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false }
              : { style: styles.content })}
          >
            {children}
          </Body>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Tasdiqlash",
  destructive = false,
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  const confirm = useCallback(() => onConfirm(), [onConfirm]);
  return (
    <Sheet visible={visible} onClose={onClose} scroll={false}>
      <View style={{ gap: spacing.md }}>
        <Text variant="h2">{title}</Text>
        <Text variant="body" color={colors.body}>
          {message}
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            title={confirmLabel}
            onPress={confirm}
            loading={loading}
            variant={destructive ? "danger" : "primary"}
          />
          <Button title="Bekor qilish" onPress={onClose} variant="ghost" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: "center",
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    ...shadow.sheet,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  content: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
});
