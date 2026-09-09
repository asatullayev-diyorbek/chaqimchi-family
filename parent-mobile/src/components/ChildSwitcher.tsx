import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors, radius } from "../theme";
import { useFamily } from "../state/family";
import { childAge } from "../lib/format";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Divider, Muted, Text } from "./primitives";

/**
 * Global child picker — a full-width dropdown bar. It's the "whose data am I
 * looking at" control; changing it re-scopes the whole Home screen. Tapping
 * opens a bottom sheet with the family + "Farzand qo‘shish".
 */
export function ChildSwitcher({ onAddChild }: { onAddChild: () => void }) {
  const { children, selectedChild, selectedChildId, setChild } = useFamily();
  const [open, setOpen] = useState(false);
  const single = children.length <= 1;
  const age = childAge(selectedChild?.birth_date ?? null);

  return (
    <>
      <Pressable
        onPress={() => !single && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Farzandni tanlash"
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 10,
            paddingLeft: 10,
            paddingRight: 14,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
          pressed && !single && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Avatar
          name={selectedChild?.name ?? "?"}
          photoUrl={selectedChild?.photo_url}
          seed={selectedChildId ?? undefined}
          size={34}
        />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {selectedChild?.name ?? "Farzand"}
          </Text>
          <Muted>{age != null ? `${age} yosh` : "Farzand"}</Muted>
        </View>
        {!single ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceSunken,
            }}
          >
            <Icon name="chevronDown" size={16} color={colors.body} />
          </View>
        ) : null}
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
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 6,
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.blueSoft : "transparent",
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Avatar name={c.name} photoUrl={c.photo_url} seed={c.id} size={40} />
                <Text variant="h3" style={{ flex: 1 }} color={active ? colors.blue : colors.text}>
                  {c.name}
                </Text>
                {active ? <Icon name="check" size={20} color={colors.blue} /> : null}
              </Pressable>
            );
          })}
          <Divider style={{ marginVertical: 8 }} />
          <Pressable
            onPress={() => {
              setOpen(false);
              onAddChild();
            }}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 6 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.blueSoft,
              }}
            >
              <Icon name="plus" size={19} color={colors.blue} />
            </View>
            <Text variant="label" color={colors.blue}>
              Farzand qo‘shish
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}
