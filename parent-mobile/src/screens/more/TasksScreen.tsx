import React, { useState } from "react";
import { Linking, Share, View } from "react-native";
import { colors } from "../../theme";
import { checkChannelMembership, getTasks, TaskItem, TaskType } from "../../api/tasks";
import { useQuery } from "../../hooks/useQuery";
import { Badge, Button, Card, ErrorState, Icon, LoadingState, Muted, Screen, Text, useToast } from "../../components";

function coins(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} coin`;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Bajarildi", color: colors.mintDark, bg: colors.mintSoft },
  pending: { label: "Tekshirilmoqda", color: colors.warning, bg: colors.warningSoft },
  rejected: { label: "Rad etildi", color: colors.danger, bg: colors.dangerSoft },
};

/** Every card ends in the same control: "O'tish" while the task is still
 * open, a disabled "✅ Bajarilgan" once it's approved. What "O'tish" does
 * is the only thing that varies per task type. */
function TaskActionButton({
  task,
  label = "O'tish →",
  onPress,
  loading,
}: {
  task: TaskItem;
  label?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  if (task.status === "approved") {
    return <Button title="✅ Bajarilgan" onPress={() => {}} disabled variant="secondary" />;
  }
  return <Button title={label} onPress={onPress} loading={loading} disabled={loading} />;
}

function ChannelJoinCard({ task, onDone }: { task: TaskItem; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function goAndCheck() {
    if (task.target_url) Linking.openURL(task.target_url);
    setBusy(true);
    try {
      const r = await checkChannelMembership();
      if (r.member) {
        toast.success("✅ Tasdiqlandi!");
        onDone();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  return <TaskActionButton task={task} onPress={goAndCheck} loading={busy} />;
}

function ReferralCard({ task, referralLink }: { task: TaskItem; referralLink: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Muted>{referralLink}</Muted>
      <TaskActionButton
        task={task}
        label="🔗 Ulashish"
        onPress={() =>
          Share.share({
            message: `Spino24 — farzandingiz uchun xavfsiz raqamli muhit. Ro'yxatdan o'ting: ${referralLink}`,
          })
        }
      />
    </View>
  );
}

function StoryTaskCard({ task, shortId }: { task: TaskItem; shortId: string }) {
  return (
    <View style={{ gap: 8 }}>
      {task.status !== "approved" ? (
        <>
          <Muted>1) Postni story qilib ulashing, 2) ustiga ID raqamingizni yozing:</Muted>
          <Text variant="h2">{shortId}</Text>
          <Muted>Hech narsa yuborish shart emas — adminlarimiz o'zi tekshirib, bonusni qo'shib beradi.</Muted>
        </>
      ) : null}
      <TaskActionButton task={task} onPress={() => task.target_url && Linking.openURL(task.target_url)} />
    </View>
  );
}

const CARD_ICON: Record<TaskType, "app" | "users" | "camera" | "sparkle"> = {
  channel_join: "app",
  referral: "users",
  telegram_story: "camera",
  instagram_story: "sparkle",
};

export default function TasksScreen() {
  const { data, loading, error, refetch, refreshing } = useQuery(getTasks, []);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error?.message ?? "Yuklanmadi"} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refetch}>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="card" size={18} color={colors.blue} />
          <Text variant="h3">Balansingiz: {coins(data.balance_uzs)}</Text>
        </View>
        <Muted>Obuna to'lovida chegirma sifatida ishlatiladi.</Muted>
        <Muted>Sizning ID raqamingiz: {data.short_id}</Muted>
      </Card>

      {data.tasks.map((task) => (
        <Card key={task.type} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name={CARD_ICON[task.type]} size={18} color={colors.blue} />
            <Text variant="h3" style={{ flex: 1 }}>
              {task.title}
            </Text>
            {task.status ? (
              <Badge {...STATUS_BADGE[task.status]} />
            ) : (
              <Badge label={`+${coins(task.reward_uzs)}`} color={colors.mintDark} bg={colors.mintSoft} />
            )}
          </View>
          {task.description ? <Muted>{task.description}</Muted> : null}
          {task.status === "rejected" && task.note ? <Muted>Sabab: {task.note}</Muted> : null}

          {task.type === "channel_join" && <ChannelJoinCard task={task} onDone={refetch} />}
          {task.type === "referral" && <ReferralCard task={task} referralLink={data.referral_link} />}
          {(task.type === "telegram_story" || task.type === "instagram_story") && (
            <StoryTaskCard task={task} shortId={data.short_id} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
