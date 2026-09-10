import React from "react";
import { View } from "react-native";
import { colors, spacing } from "../theme";
import { Spino24Wordmark } from "./brand";
import { ChildSwitcher } from "./ChildSwitcher";
import { Icon, IconName } from "./Icon";
import { IconButton, Text } from "./primitives";

/**
 * Header for a tab-root screen other than Home: the screen title on the left,
 * and (for child-scoped screens) the same global child picker as Home on the
 * right, so the "whose data" control is in one consistent place everywhere.
 */
export function TabHeader({
  title,
  subtitle,
  childSwitcher = false,
  onAddChild,
}: {
  title: string;
  subtitle?: string;
  childSwitcher?: boolean;
  onAddChild?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
      <View style={{ flex: 1, gap: 3, paddingTop: 2 }}>
        <Text variant="h1">{title}</Text>
        {subtitle ? (
          <Text variant="body" color={colors.muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {childSwitcher ? <ChildSwitcher onAddChild={onAddChild ?? (() => {})} /> : null}
    </View>
  );
}

/**
 * Screen title block. On the Home tab it shows the Spino24 wordmark; elsewhere
 * a plain title + optional subtitle. `action` renders a single icon button
 * on the right (notifications bell, add, etc.).
 */
export function AppHeader({
  title,
  subtitle,
  brand = false,
  action,
  badgeCount,
}: {
  title?: string;
  subtitle?: string;
  brand?: boolean;
  action?: { icon: IconName; onPress: () => void; label: string };
  badgeCount?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 3 }}>
        {brand ? <Spino24Wordmark size={24} /> : null}
        {title ? <Text variant={brand ? "h3" : "h1"}>{title}</Text> : null}
        {subtitle ? (
          <Text variant="body" color={colors.muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <View>
          <IconButton
            name={action.icon}
            onPress={action.onPress}
            accessibilityLabel={action.label}
            color={colors.body}
          />
          {badgeCount ? (
            <View
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 3,
                borderRadius: 8,
                backgroundColor: colors.danger,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>
                {badgeCount > 9 ? "9+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
