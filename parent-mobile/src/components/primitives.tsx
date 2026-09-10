import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, shadow, spacing, typography } from "../theme";
import { Icon, IconName } from "./Icon";

// --- Text ---------------------------------------------------------------

type Variant = keyof typeof typography;

export function Text({
  variant = "body",
  color = colors.text,
  style,
  ...props
}: TextProps & { variant?: Variant; color?: string }) {
  return <RNText {...props} style={[typography[variant], { color }, style]} />;
}

export function Muted({ style, ...props }: TextProps & { variant?: Variant }) {
  return <Text variant="caption" color={colors.muted} style={style} {...props} />;
}

// --- Card --------------------------------------------------------------

export function Card({
  children,
  style,
  onPress,
  padded = true,
  tone = "surface",
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padded?: boolean;
  tone?: "surface" | "muted" | "hero";
}) {
  const bg =
    tone === "muted" || tone === "hero" ? colors.surfaceMuted : colors.surface;
  const body = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: colors.cardBorder, padding: padded ? spacing.lg : 0 },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.995 }] } : null)}
    >
      {body}
    </Pressable>
  );
}

// --- Buttons ----------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
  full = true,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: ViewStyle;
  full?: boolean;
}) {
  const off = disabled || loading;
  const skin: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.blue, fg: "#fff" },
    secondary: { bg: colors.blueSoft, fg: colors.blue, border: colors.blueSoft },
    ghost: { bg: "transparent", fg: colors.body, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const s = skin[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        full && { alignSelf: "stretch" },
        {
          backgroundColor: s.bg,
          borderWidth: s.border ? 1 : 0,
          borderColor: s.border,
        },
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={s.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={17} color={s.fg} /> : null}
          <RNText style={[styles.buttonText, { color: s.fg }]}>{title}</RNText>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color = colors.body,
  size = 20,
  hitSlop = 10,
  accessibilityLabel,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  hitSlop?: number;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

// --- Field ------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[
          styles.field,
          { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
          error ? { borderColor: colors.danger } : null,
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Muted>{hint}</Muted>
      ) : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Text variant="caption" color={colors.danger}>
      {message}
    </Text>
  );
}

// --- Chip / Badge / Divider -----------------------------------------

export function Chip({
  label,
  active = false,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: { fg: string; bg: string };
}) {
  const fg = active ? "#fff" : tone?.fg ?? colors.muted;
  const bg = active ? colors.blueDark : tone?.bg ?? "transparent";
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        { backgroundColor: bg, borderColor: active ? colors.blueDark : colors.border },
      ]}
    >
      <RNText style={{ fontSize: 12.5, fontWeight: "700", color: fg }}>{label}</RNText>
    </Pressable>
  );
}

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <RNText style={{ fontSize: 11, fontWeight: "700", color }}>{label}</RNText>
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

// --- SectionHeader --------------------------------------------------

export function SectionHeader({
  title,
  hint,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Icon name={icon} size={17} color={colors.blue} /> : null}
        <View style={{ flexShrink: 1 }}>
          <Text variant="h3">{title}</Text>
          {hint ? <Muted style={{ marginTop: 2 }}>{hint}</Muted> : null}
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text variant="label" color={colors.blue} style={{ fontSize: 13 }}>
              {actionLabel}
            </Text>
            <Icon name="chevronRight" size={15} color={colors.blue} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// --- Skeleton ------------------------------------------------------

export function Skeleton({
  width = "100%",
  height = 16,
  radius: r = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.surfaceSunken, opacity: 0.7 },
        style,
      ]}
    />
  );
}

/** A card-shaped placeholder — use while a screen's first load is in flight. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card style={{ gap: 12 }}>
      <Skeleton width="55%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "70%" : "100%"} height={12} />
      ))}
    </Card>
  );
}

// --- ListRow --------------------------------------------------------

export function ListRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  right,
  onPress,
  danger = false,
  first = false,
}: {
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  const content = (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: iconBg ?? colors.blueSoft },
          ]}
        >
          <Icon name={icon} size={18} color={iconColor ?? colors.blue} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color={danger ? colors.danger : colors.text}>
          {title}
        </Text>
        {subtitle ? <Muted numberOfLines={1}>{subtitle}</Muted> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.faint} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadow.card,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
