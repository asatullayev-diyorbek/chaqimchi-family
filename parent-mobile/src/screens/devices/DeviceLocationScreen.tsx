import React, { useState } from "react";
import { Image, Platform, View } from "react-native";
import { colors } from "../../theme";
import { formatDate, relativeTime } from "../../lib/format";
import { osmTileUrl, tileForPoint } from "../../lib/geo";
import { sendDeviceLocation } from "../../api/tracking";
import { ApiError } from "../../api/client";
import { Button, Card, Icon, Muted, Screen, Text, useToast } from "../../components";

// City/district-scale, not street-level — matches the accuracy this data
// actually has (see the warning below). A closer zoom would look more
// precise than the underlying IP/GPS fix really is. Only used as the
// initial framing on web (the embedded map can still be zoomed/panned
// freely from there) and as the sole view on native (no pinch-zoom there
// yet — no maps SDK in this app).
const ZOOM = 13;
const TILE_SIZE = 256;
// Degrees of padding around the point for the web embed's initial bbox —
// wide enough to show real surroundings, not just the point itself.
const BBOX_PAD = 0.02;

// Plain <iframe> — no maps SDK/dependency needed. OpenStreetMap's own
// export/embed page is a full Leaflet map: pinch-to-zoom and drag-to-pan
// both work exactly as they would on osm.org itself. Built via
// React.createElement (not JSX) because "iframe" isn't a valid intrinsic
// element in React Native's JSX namespace — this file still compiles for
// the native bundle even though this component is only ever invoked when
// Platform.OS === "web".
function WebMapFrame({ lat, lng }: { lat: number; lng: number }) {
  const bbox = [lng - BBOX_PAD, lat - BBOX_PAD, lng + BBOX_PAD, lat + BBOX_PAD].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lng}&layer=mapnik`;
  return React.createElement("iframe", {
    src,
    style: { width: "100%", height: "100%", border: 0 },
    loading: "lazy",
  });
}

function StaticTileMap({ lat, lng }: { lat: number; lng: number }) {
  const tile = tileForPoint(lat, lng, ZOOM);
  return (
    <>
      <Image
        source={{ uri: osmTileUrl(tile.x, tile.y, tile.zoom) }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      {/* Approximate-area circle, not a pinpoint — the accuracy this data
          has is a neighborhood, not an exact spot. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${(tile.pixelX / TILE_SIZE) * 100}%`,
          top: `${(tile.pixelY / TILE_SIZE) * 100}%`,
          width: 56,
          height: 56,
          marginLeft: -28,
          marginTop: -28,
          borderRadius: 28,
          backgroundColor: "rgba(37, 99, 235, 0.25)",
          borderWidth: 2,
          borderColor: colors.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.blue,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      </View>
    </>
  );
}

export default function DeviceLocationScreen({ route }: any) {
  const { deviceId, lat, lng, label, source, updatedAt } = route.params as {
    deviceId: string;
    lat: number;
    lng: number;
    label: string | null;
    source: "ip" | "gps" | "";
    updatedAt: string | null;
  };
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const isGps = source === "gps";

  async function handleSendToBot() {
    setSending(true);
    try {
      await sendDeviceLocation(deviceId);
      toast.success("Joylashuv botga yuborildi");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        toast.error("Avval Telegram akkauntingizni ulang");
      } else {
        toast.error(err instanceof Error ? err.message : "Yuborib bo'lmadi");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen scroll>
      <Card style={{ gap: 4 }}>
        <Text variant="h3">{label || "Noma'lum joy"}</Text>
        <Muted>Yangilangan: {updatedAt ? relativeTime(updatedAt) : "—"}</Muted>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <View style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceSunken }}>
          {Platform.OS === "web" ? <WebMapFrame lat={lat} lng={lng} /> : <StaticTileMap lat={lat} lng={lng} />}
        </View>
      </Card>

      <Card style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Icon name="info" size={18} color={colors.warning} />
        <Muted style={{ flex: 1 }}>
          {isGps
            ? "Bu joylashuv qurilmaning joylashuv xizmati orqali aniqlangan, lekin baribir bir necha o'nlab metr xatolik bo'lishi mumkin."
            : "Bu joylashuv taxminiy — internet aloqasi manzili (IP) orqali aniqlangan. Aniqlik shahar yoki tuman darajasida, xona yoki bino darajasida emas."}
        </Muted>
      </Card>

      <Button
        title="Botga yuborish"
        variant="secondary"
        icon="send"
        onPress={handleSendToBot}
        loading={sending}
      />
    </Screen>
  );
}
