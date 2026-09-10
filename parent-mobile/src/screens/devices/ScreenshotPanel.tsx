import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { colors, radius, spacing } from "../../theme";
import {
  Button,
  Card,
  Icon,
  Muted,
  Sheet,
  Text,
  useToast,
} from "../../components";
import { ApiError } from "../../api/client";
import {
  deleteScreenshot,
  isPending,
  listScreenshots,
  requestScreenshot,
  RETENTION_LABEL,
  type Screenshot,
  type ScreenshotRetention,
} from "../../api/screenshots";

const RETENTION_ORDER: ScreenshotRetention[] = ["day", "week", "month"];
const POLL_MS = 3500;

/** "5 kun" / "hozir tugaydi" — time left until expires_at. */
function expiryLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "muddati tugadi";
  const days = Math.round(ms / 86_400_000);
  if (days >= 1) return `${days} kun qoldi`;
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return `${hours} soat qoldi`;
}

export default function ScreenshotPanel({
  deviceId,
  online,
}: {
  deviceId: string;
  online: boolean;
}) {
  const toast = useToast();
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [viewing, setViewing] = useState<Screenshot | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setShots(await listScreenshots(deviceId));
    } catch {
      /* keep the last good list; the panel is secondary content */
    }
  }, [deviceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll only while something is still being captured.
  const waiting = shots.some(isPending);
  useEffect(() => {
    if (waiting && !timer.current) {
      timer.current = setInterval(refresh, POLL_MS);
    } else if (!waiting && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [waiting, refresh]);

  const submit = useCallback(
    async (retention: ScreenshotRetention) => {
      setPickerOpen(false);
      setRequesting(true);
      try {
        await requestScreenshot(deviceId, retention);
        await refresh();
        toast.success("So‘rov yuborildi");
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        const msg =
          status === 429
            ? "Soatiga 6 martadan ko‘p so‘rab bo‘lmaydi"
            : status === 503
              ? "Ekran rasmi xizmati hali ulanmagan"
              : status >= 500 || status === 0
                ? "Server javob bermadi. Birozdan so‘ng qayta urinib ko‘ring."
                : (e as Error)?.message ?? "So‘rov yuborilmadi";
        toast.error(msg);
      } finally {
        setRequesting(false);
      }
    },
    [deviceId, refresh, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      setViewing(null);
      try {
        await deleteScreenshot(id);
        setShots((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        toast.error((e as Error)?.message ?? "O‘chirilmadi");
      }
    },
    [toast],
  );

  const ready = shots.filter((s) => s.status === "uploaded" && s.url);
  const failed = shots.filter((s) => s.status === "failed");

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="camera" size={17} color={colors.blue} />
          <Text variant="h3">Ekran rasmi</Text>
        </View>
        <Muted>
          Faqat siz so‘raganda olinadi. Farzand har safar buni ko‘radi. Rasm
          tanlangan muddat o‘tgach o‘chiriladi.
        </Muted>
      </View>

      <Button
        title={online ? "Ekran rasmini olish" : "Qurilma onlayn bo‘lganda mumkin"}
        icon="camera"
        onPress={() => setPickerOpen(true)}
        loading={requesting}
        disabled={!online}
      />

      {waiting ? (
        <View style={styles.waitRow}>
          <ActivityIndicator color={colors.blue} />
          <Muted style={{ flex: 1 }}>
            Kutilmoqda — farzand qurilmasidan so‘ralmoqda. Bir necha soniya
            ichida tayyor bo‘ladi.
          </Muted>
        </View>
      ) : null}

      {failed.map((s) => (
        <View key={s.id} style={styles.failRow}>
          <Icon name="alert" size={15} color={colors.danger} />
          <Muted style={{ flex: 1, color: colors.danger }}>
            Rasm olinmadi{s.error ? ` — ${s.error}` : ""}
          </Muted>
        </View>
      ))}

      {ready.length ? (
        <View style={styles.grid}>
          {ready.map((s) => (
            <Pressable
              key={s.id}
              style={styles.thumbWrap}
              onPress={() => setViewing(s)}
            >
              <Image source={{ uri: s.url! }} style={styles.thumb} />
              <Text
                variant="caption"
                color={colors.muted}
                style={{ fontSize: 11 }}
                numberOfLines={1}
              >
                {expiryLabel(s.expires_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : !waiting ? (
        <Muted style={{ fontStyle: "italic" }}>Hali ekran rasmi olinmagan.</Muted>
      ) : null}

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Rasm qancha saqlansin?"
        scroll={false}
      >
        <View style={{ gap: 2 }}>
          {RETENTION_ORDER.map((r) => (
            <Pressable
              key={r}
              style={styles.retRow}
              onPress={() => submit(r)}
            >
              <Text variant="body">{RETENTION_LABEL[r]}</Text>
              {r === "week" ? (
                <Muted style={{ fontSize: 12 }}>tavsiya etiladi</Muted>
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewer}>
          <View style={styles.viewerBar}>
            <Pressable onPress={() => setViewing(null)} hitSlop={12}>
              <Icon name="close" size={24} color="#fff" />
            </Pressable>
            {viewing ? (
              <Text variant="caption" color="rgba(255,255,255,0.7)">
                {expiryLabel(viewing.expires_at)}
              </Text>
            ) : null}
            <Pressable
              onPress={() => viewing && remove(viewing.id)}
              hitSlop={12}
            >
              <Icon name="trash" size={22} color="#fff" />
            </Pressable>
          </View>
          {viewing?.url ? (
            <Image
              source={{ uri: viewing.url }}
              style={styles.full}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  failRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumbWrap: { width: "31%", gap: 3 },
  thumb: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  retRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 12,
  },
  full: { flex: 1, width: "100%" },
});
