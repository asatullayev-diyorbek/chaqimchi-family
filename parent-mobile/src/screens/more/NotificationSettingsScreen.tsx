import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Switch, View } from "react-native";
import { colors } from "../../theme";
import {
  getNotificationPrefs,
  NotificationPrefs,
  telegramLinkStart,
  telegramLinkStatus,
  telegramUnlink,
  updateNotificationPrefs,
} from "../../api/notifications";
import { useQuery } from "../../hooks/useQuery";
import {
  Button,
  Card,
  ConfirmSheet,
  ErrorState,
  Icon,
  LoadingState,
  Muted,
  Screen,
  Text,
  useToast,
} from "../../components";

export default function NotificationSettingsScreen() {
  const toast = useToast();
  const { data, loading, error, refetch, reload } = useQuery(getNotificationPrefs, []);
  const [local, setLocal] = useState<NotificationPrefs | null>(null);
  const prefs = local ?? data;
  const [linking, setLinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const toggle = useCallback(
    async (alertType: string, on: boolean) => {
      if (!prefs) return;
      const next = {
        ...prefs,
        alerts: prefs.alerts.map((a) => (a.alert_type === alertType ? { ...a, via_telegram: on } : a)),
      };
      setLocal(next);
      try {
        await updateNotificationPrefs([{ alert_type: alertType, via_telegram: on }]);
      } catch (e: any) {
        setLocal(prefs);
        toast.error(e?.message ?? "Saqlanmadi");
      }
    },
    [prefs, toast],
  );

  const startLink = useCallback(async () => {
    setLinking(true);
    try {
      const { token, bot_url } = await telegramLinkStart();
      await Linking.openURL(bot_url);
      poll.current = setInterval(async () => {
        const s = await telegramLinkStatus(token).catch(() => null);
        if (s?.status === "linked") {
          if (poll.current) clearInterval(poll.current);
          setLinking(false);
          setLocal(null);
          await reload();
          toast.success("Telegram ulandi");
        } else if (s && s.status !== "pending") {
          if (poll.current) clearInterval(poll.current);
          setLinking(false);
          toast.error("Ulanmadi, qayta urinib ko‘ring");
        }
      }, 2500);
    } catch (e: any) {
      setLinking(false);
      toast.error(e?.message ?? "Telegram ochilmadi");
    }
  }, [reload, toast]);

  const doUnlink = useCallback(async () => {
    try {
      await telegramUnlink();
      setLocal(null);
      await reload();
      toast.success("Telegram uzildi");
    } catch (e: any) {
      toast.error(e?.message ?? "Uzilmadi");
    } finally {
      setConfirmUnlink(false);
    }
  }, [reload, toast]);

  if (loading && !prefs) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (error && !prefs) {
    return (
      <Screen>
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }
  if (!prefs) return null;

  return (
    <Screen scroll>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.blueSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="telegram" size={19} color={colors.blue} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">Telegram</Text>
            <Muted>
              {prefs.telegram.linked
                ? prefs.telegram.username
                  ? `@${prefs.telegram.username}`
                  : "Ulangan"
                : "Ulanmagan"}
            </Muted>
          </View>
        </View>
        {prefs.telegram.linked ? (
          <Button title="Telegram’ni uzish" variant="ghost" onPress={() => setConfirmUnlink(true)} />
        ) : (
          <Button title="Telegram’ni ulash" variant="secondary" icon="link" onPress={startLink} loading={linking} />
        )}
        <Muted>
          Mobil ilova bildirishnomalari hozircha Telegram orqali yuboriladi. Push bildirishnomalar keyin
          qo‘shiladi.
        </Muted>
      </Card>

      <Card padded={false}>
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text variant="h3">Qaysi hodisalar haqida xabar berilsin</Text>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {prefs.alerts.map((a, i) => (
            <View
              key={a.alert_type}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 13,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <Text variant="label" color={colors.body} style={{ flex: 1 }}>
                {a.label}
              </Text>
              <Switch
                value={a.via_telegram}
                onValueChange={(v) => toggle(a.alert_type, v)}
                trackColor={{ true: colors.blue, false: colors.borderStrong }}
                disabled={!prefs.telegram.linked}
              />
            </View>
          ))}
        </View>
      </Card>

      <ConfirmSheet
        visible={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        onConfirm={doUnlink}
        title="Telegram’ni uzasizmi?"
        message="Bildirishnomalar va parol tiklash Telegram orqali ishlamay qoladi."
        confirmLabel="Uzish"
        destructive
      />
    </Screen>
  );
}
