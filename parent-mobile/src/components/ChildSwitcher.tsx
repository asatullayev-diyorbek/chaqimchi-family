import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../theme";
import { useFamily } from "../state/family";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Divider, Muted, Text } from "./primitives";

/**
 * Header child picker — the global "whose data am I looking at" control.
 * Shows the selected child as a compact pill; tapping opens a bottom sheet
 * with the full family + "Farzand qo‘shish".
 */
export function ChildSwitcher({ onAddChild }: { onAddChild: () => void }) {
  const { children, selectedChild, selectedChildId, setChild } = useFamily();
  const [open, setOpen] = useState(false);

  const only = children.length <= 1;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
          paddingLeft: 6,
          paddingRight: only ? 10 : 8,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          maxWidth: 190,
        }}
      >
        <Avatar
          name={selectedChild?.name ?? "?"}
          photoUrl={selectedChild?.photo_url}
          seed={selectedChildId ?? undefined}
          size={26}
        />
        <Text variant="label" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5 }}>
          {selectedChild?.name ?? "Farzand"}
        </Text>
        {!only ? <Icon name="chevronDown" size={15} color={colors.faint} /> : null}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Farzandni tanlang" scroll={false}>
        <View>
          {children.map((c) => {
            const active = c.id === selectedChildId;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setChild(c.id);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Avatar name={c.name} photoUrl={c.photo_url} seed={c.id} size={38} />
                <Text variant="h3" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                {active ? <Icon name="check" size={20} color={colors.blue} /> : null}
              </Pressable>
            );
          })}
          <Divider style={{ marginVertical: 6 }} />
          <Pressable
            onPress={() => {
              setOpen(false);
              onAddChild();
            }}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.blueSoft,
              }}
            >
              <Icon name="plus" size={18} color={colors.blue} />
            </View>
            <Text variant="label" color={colors.blue}>
              Farzand qo‘shish
            </Text>
          </Pressable>
          <Muted style={{ marginTop: 2 }}>
            Tanlangan farzand bo‘yicha barcha ma’lumot yangilanadi.
          </Muted>
        </View>
      </Sheet>
    </>
  );
}
