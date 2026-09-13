import React, { useState } from "react";
import { Linking, Share, View } from "react-native";
import { colors, radius } from "../../theme";
import { checkChannelMembership, getTasks, TaskItem, TaskType } from "../../api/tasks";
import { useQuery } from "../../hooks/useQuery";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  ListRow,
  LoadingState,
  Muted,
  Screen,
  Sheet,
  Text,
  useToast,
} from "../../components";

function coins(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")}`;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Bajarildi", color: colors.mintDark, bg: colors.mintSoft },
  pending: { label: "Tekshirilmoqda", color: colors.warning, bg: colors.warningSoft },
  rejected: { label: "Rad etildi", color: colors.danger, bg: colors.dangerSoft },
};

const CARD_ICON: Record<TaskType, "app" | "users" | "camera" | "sparkle"> = {
  channel_join: "app",
  referral: "users",
  telegram_story: "camera",
  instagram_story: "sparkle",
};

const CARD_TINT: Record<TaskType, { color: string; bg: string }> = {
  channel_join: { color: colors.blue, bg: colors.blueSoft },
  referral: { color: colors.mintDark, bg: colors.mintSoft },
  telegram_story: { color: colors.blue, bg: colors.blueSoft },
  instagram_story: { color: colors.catPurple, bg: colors.catPurpleBg },
};

/** A pill matching the mockup's rounded coin-reward badge — used both in
 * the list row and again inside the detail sheet. */
function CoinBadge({ amount }: { amount: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.mintSoft,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}
    >
      <Text variant="label" color={colors.mintDark}>
        +{coins(amount)}
      </Text>
      <Icon name="sparkle" size={13} color={colors.mintDark} />
    </View>
  );
}

/** Every task's detail sheet ends in the same control: "O'tish" while the
 * task is still open, a disabled "✅ Bajarilgan" once it's approved. What
 * "O'tish" does is the only thing that varies per task type. */
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

function ChannelJoinDetail({ task, onDone }: { task: TaskItem; onDone: () => void }) {
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

function ReferralDetail({ task, referralLink }: { task: TaskItem; referralLink: string }) {
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

function StoryTaskDetail({ task, shortId }: { task: TaskItem; shortId: string }) {
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

function TaskDetailSheet({
  task,
  onClose,
  data,
  onDone,
}: {
  task: TaskItem | null;
  onClose: () => void;
  data: { referral_link: string; short_id: string };
  onDone: () => void;
}) {
  return (
    <Sheet visible={!!task} onClose={onClose} title={task?.title}>
      {task ? (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: CARD_TINT[task.type].bg,
              }}
            >
              <Icon name={CARD_ICON[task.type]} size={20} color={CARD_TINT[task.type].color} />
            </View>
            {task.status ? <Badge {...STATUS_BADGE[task.status]} /> : <CoinBadge amount={task.reward_uzs} />}
          </View>
          {task.description ? <Muted>{task.description}</Muted> : null}
          {task.status === "rejected" && task.note ? <Muted>Sabab: {task.note}</Muted> : null}

          {task.type === "channel_join" && <ChannelJoinDetail task={task} onDone={onDone} />}
          {task.type === "referral" && <ReferralDetail task={task} referralLink={data.referral_link} />}
          {(task.type === "telegram_story" || task.type === "instagram_story") && (
            <StoryTaskDetail task={task} shortId={data.short_id} />
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

export default function TasksScreen() {
  const { data, loading, error, refetch, refreshing } = useQuery(getTasks, []);
  const [selected, setSelected] = useState<TaskItem | null>(null);

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
      <Card style={{ gap: 4 }}>
        <Text variant="h2">Vazifalarni bajaring, coin ishlang!</Text>
        <Muted>Oddiy vazifalarni bajaring va obuna uchun coin to'plang.</Muted>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Icon name="card" size={16} color={colors.blue} />
          <Text variant="label">Balansingiz: {coins(data.balance_uzs)} coin</Text>
        </View>
        <Muted>ID raqamingiz: {data.short_id}</Muted>
      </Card>

      <Card padded={false}>
        {data.tasks.map((task, i) => (
          <ListRow
            key={task.type}
            first={i === 0}
            icon={CARD_ICON[task.type]}
            iconColor={CARD_TINT[task.type].color}
            iconBg={CARD_TINT[task.type].bg}
            title={task.title}
            subtitle={task.description}
            onPress={() => setSelected(task)}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {task.status ? <Badge {...STATUS_BADGE[task.status]} /> : <CoinBadge amount={task.reward_uzs} />}
                <Icon name="chevronRight" size={18} color={colors.faint} />
              </View>
            }
          />
        ))}
      </Card>

      <Muted style={{ textAlign: "center" }}>Yig'ilgan coinlar obuna to'lovida chegirma sifatida ishlatiladi.</Muted>

      <TaskDetailSheet task={selected} onClose={() => setSelected(null)} data={data} onDone={refetch} />
    </Screen>
  );
}
