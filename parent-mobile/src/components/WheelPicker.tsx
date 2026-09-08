import React, { useEffect, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from "react-native";
import { colors } from "../theme";
import { Text } from "./primitives";

const ITEM_H = 40;
const VISIBLE = 5; // odd, so one row is centred

/**
 * A single scroll-snap column of values. Dependency-free (ScrollView with
 * paging-like snap). Used by DurationPicker and TimeRangePicker.
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
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    if (values[clamped] !== value) onChange(values[clamped]);
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
  }

  return (
    <View style={{ height: ITEM_H * VISIBLE, width, overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: ITEM_H * ((VISIBLE - 1) / 2),
          height: ITEM_H,
          borderRadius: 10,
          backgroundColor: colors.blueSoft,
        }}
      />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_H * ((VISIBLE - 1) / 2) }}
      >
        {values.map((v) => (
          <View key={v} style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}>
            <Text variant="h3" color={v === value ? colors.blue : colors.faint}>
              {v}
              {suffix ? <Text variant="caption" color={colors.faint}>{` ${suffix}`}</Text> : null}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
