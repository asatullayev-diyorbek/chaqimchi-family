import React from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { childAge } from "../../lib/format";
import { useFamily } from "../../state/family";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  SkeletonCard,
  Muted,
  Screen,
  Text,
} from "../../components";

export default function ChildrenScreen({ navigation }: any) {
  const { children, linkedDevices, loading } = useFamily();

  if (loading) {
    return (
      <Screen>
        <View style={{ gap: 12 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {children.length === 0 ? (
        <EmptyState
          icon="users"
          title="Farzand qo‘shilmagan"
          message="Har bir farzand uchun alohida qoidalar va faoliyat ko‘rinishi bo‘ladi."
          action={{ label: "Farzand qo‘shish", onPress: () => navigation.navigate("AddChild") }}
        />
      ) : (
        <>
          {children.map((c) => {
            const count = linkedDevices.filter((d) => d.child_id === c.id).length;
            const age = childAge(c.birth_date);
            return (
              <Card
                key={c.id}
                onPress={() => navigation.navigate("ChildDetail", { childId: c.id })}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Avatar name={c.name} photoUrl={c.photo_url} seed={c.id} size={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3">{c.name}</Text>
                  <Muted>
                    {age != null ? `${age} yosh · ` : ""}
                    {count} ta qurilma
                  </Muted>
                </View>
                <Icon name="chevronRight" size={18} color={colors.faint} />
              </Card>
            );
          })}
          <Button title="Farzand qo‘shish" icon="plus" variant="secondary" onPress={() => navigation.navigate("AddChild")} />
        </>
      )}
    </Screen>
  );
}
