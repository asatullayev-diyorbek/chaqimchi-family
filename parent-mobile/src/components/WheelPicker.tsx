import React from "react";
import { Pressable, View } from "react-native";
import { colors } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./primitives";

const ITEM_H = 40;

/**
 * A single value column: the current value in the middle, the previous and
 * next values faded above/below it, and up/down arrow buttons to step
 * between them. No scroll/drag gesture at all — inside the Telegram Mini
 * App's embedded WebView, drag/momentum scroll was never reliable
 * (onScrollEndDrag/onMomentumScrollEnd didn't consistently fire, and the
 * displayed value could desync from the real one), so stepping is the only
 * interaction, which a plain tap always handles correctly everywhere.
 */
export function WheelColumn({
  values,
  value,
  onChange,
  suffix,
  width = 84,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  width?: number;
}) {
  const idx = Math.max(0, values.indexOf(value));
  const prev = idx > 0 ? values[idx - 1] : null;
  const next = idx < values.length - 1 ? values[idx + 1] : null;

  function step(delta: number) {
    const n = Math.max(0, Math.min(values.length - 1, idx + delta));
    if (values[n] !== value) onChange(values[n]);
  }

  function row(v: number | null, main: boolean) {
    if (v === null) {
      return <View style={{ height: ITEM_H }} />;
    }
    return (
      <Pressable
        onPress={() => v !== value && onChange(v)}
        style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
      >
        <Text variant={main ? "h3" : "body"} color={main ? colors.blue : colors.faint}>
          {v}
          {suffix ? <Text variant="caption" color={colors.faint}>{` ${suffix}`}</Text> : null}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ width, alignItems: "center", gap: 2 }}>
      <Pressable
        onPress={() => step(-1)}
        disabled={idx <= 0}
        hitSlop={8}
        style={{ padding: 6, opacity: idx <= 0 ? 0.3 : 1 }}
      >
        <Icon name="chevronUp" size={20} color={colors.blue} />
      </Pressable>

      <View style={{ width: "100%" }}>
        {row(prev, false)}
        <View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: ITEM_H,
              borderRadius: 10,
              backgroundColor: colors.blueSoft,
            }}
          />
          {row(value, true)}
        </View>
        {row(next, false)}
      </View>

      <Pressable
        onPress={() => step(1)}
        disabled={idx >= values.length - 1}
        hitSlop={8}
        style={{ padding: 6, opacity: idx >= values.length - 1 ? 0.3 : 1 }}
      >
        <Icon name="chevronDown" size={20} color={colors.blue} />
      </Pressable>
    </View>
  );
}
