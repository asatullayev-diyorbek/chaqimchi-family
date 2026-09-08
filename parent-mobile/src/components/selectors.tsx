import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { colors, radius } from "../theme";
import { useFamily } from "../state/family";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Muted, Text } from "./primitives";

/**
 * Horizontal child picker. Hidden when the family has one child — there's
 * nothing to switch between.
 */
export function ChildSelector() {
  const { children, selectedChildId, setChild } = useFamily();
  if (children.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
    >
      {children.map((c) => {
        const active = c.id === selectedChildId;
        return (
          <Pressable
            key={c.id}
            onPress={() => setChild(c.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? colors.blue : colors.border,
              backgroundColor: active ? colors.blueSoft : colors.surface,
            }}
          >
            <Avatar name={c.name} photoUrl={c.photo_url} seed={c.id} size={24} />
            <Text
              variant="label"
              color={active ? colors.blue : colors.body}
              style={{ fontSize: 13 }}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Device scope picker for the Activity screen. Shows the current scope as a
 * pill; tapping opens a sheet with "Barcha qurilmalar" + each device. When the
 * child has a single device the picker is inert (just shows the device name).
 */
export function DeviceScopePicker() {
  const { childDevices, selectedDeviceId, setDevice, activeDevice, allDevices } = useFamily();
  const [open, setOpen] = useState(false);

  if (childDevices.length === 0) return null;
  const label = allDevices
    ? "Barcha qurilmalar"
    : activeDevice?.child_name || activeDevice?.platform || "Qurilma";

  const single = childDevices.length === 1;

  return (
    <>
      <Pressable
        onPress={() => !single && setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Icon name="device" size={14} color={colors.muted} />
        <Text variant="label" color={colors.body} style={{ fontSize: 13 }}>
          {label}
        </Text>
        {!single ? <Icon name="chevronDown" size={14} color={colors.faint} /> : null}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Qurilmani tanlang" scroll={false}>
        <View style={{ gap: 4 }}>
          <ScopeRow
            label="Barcha qurilmalar"
            hint="Har bir qurilma alohida ko‘rsatiladi"
            active={allDevices}
            onPress={() => {
              setDevice(null);
              setOpen(false);
            }}
          />
          {childDevices.map((d) => (
            <ScopeRow
              key={d.id}
              label={d.child_name || d.platform}
              hint={d.platform === "windows" ? "Windows" : d.platform === "android" ? "Android" : "iPhone"}
              active={selectedDeviceId === d.id}
              onPress={() => {
                setDevice(d.id);
                setOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </>
  );
}

function ScopeRow({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 4,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{label}</Text>
        <Muted>{hint}</Muted>
      </View>
      {active ? <Icon name="check" size={18} color={colors.blue} /> : null}
    </Pressable>
  );
}
