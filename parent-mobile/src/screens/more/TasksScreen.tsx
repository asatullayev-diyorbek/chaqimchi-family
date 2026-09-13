import React, { useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "../../theme";
import { checkChannelMembership, getTasks, TaskItem, TaskType } from "../../api/tasks";
import { useQuery } from "../../hooks/useQuery";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
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

// Telegram's own brand blue — the two Telegram-related tasks use it so the
// icon reads as "the real Telegram", not a generic tinted glyph.
const TELEGRAM_BLUE = "#26A5E4";
const INSTAGRAM_GRADIENT = ["#4f5bd5", "#962fbf", "#d62976", "#fa7e1e"] as const;

/** The task's leading badge, drawn as the real Telegram/Instagram mark
 * rather than a generic Feather glyph — a flat colored circle for
 * Telegram/referral/channel, the actual Instagram gradient for that one. */
function TaskIconBadge({ type, size = 44 }: { type: TaskType; size: number }) {
  const iconSize = Math.round(size * 0.46);
  const shape = { width: size, height: size, borderRadius: size / 2, alignItems: "center" as const, justifyContent: "center" as const };

  if (type === "instagram_story") {
    return (
      <LinearGradient colors={INSTAGRAM_GRADIENT} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={shape}>
        <FontAwesome5 name="instagram" size={iconSize} color="#fff" brand />
      </LinearGradient>
    );
  }
  if (type === "telegram_story") {
    return (
      <View style={[shape, { backgroundColor: TELEGRAM_BLUE }]}>
        <FontAwesome5 name="telegram" size={iconSize} color="#fff" brand />
      </View>
    );
  }
  if (type === "channel_join") {
    return (
      <View style={[shape, { backgroundColor: TELEGRAM_BLUE }]}>
        <FontAwesome5 name="bullhorn" size={iconSize * 0.9} color="#fff" solid />
      </View>
    );
  }
  return (
    <View style={[shape, { backgroundColor: colors.mintDark }]}>
      <FontAwesome5 name="user-friends" size={iconSize * 0.85} color="#fff" solid />
    </View>
  );
}

/** A pill matching the mockup's rounded coin-reward badge — used both in
 * the list row and again inside the detail sheet. */
const COIN_GOLD = "#B7791F";

function CoinBadge({ amount }: { amount: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: colors.mintSoft,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
      }}
    >
      <Text variant="label" color={colors.mintDark}>
        +{coins(amount)}
      </Text>
      <FontAwesome5 name="coins" size={13} color={COIN_GOLD} solid />
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
            <TaskIconBadge type={task.type} size={48} />
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
          <Pressable
            key={task.type}
            onPress={() => setSelected(task)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <TaskIconBadge type={task.type} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{task.title}</Text>
              {task.description ? <Muted numberOfLines={1}>{task.description}</Muted> : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {task.status ? <Badge {...STATUS_BADGE[task.status]} /> : <CoinBadge amount={task.reward_uzs} />}
              <Icon name="chevronRight" size={18} color={colors.faint} />
            </View>
          </Pressable>
        ))}
      </Card>

      <Muted style={{ textAlign: "center" }}>Yig'ilgan coinlar obuna to'lovida chegirma sifatida ishlatiladi.</Muted>

      <TaskDetailSheet task={selected} onClose={() => setSelected(null)} data={data} onDone={refetch} />
    </Screen>
  );
}
