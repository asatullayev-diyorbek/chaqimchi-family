import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { colors, radius } from "../../theme";
import { verifyEnrollCode } from "../../api/children";
import { useFamily } from "../../state/family";
import { canScanQr, scanQrWithTelegram } from "../../lib/telegram";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Icon,
  ListRow,
  Muted,
  Screen,
  Sheet,
  Spino24Badge,
  Text,
  useToast,
} from "../../components";

// expo-barcode-scanner only works on a native build (it throws on web). Load
// it lazily and only use it off-web; inside Telegram we use the native QR
// scanner, and on a plain browser we fall back to manual entry.
let BarCodeScanner: any = null;
if (Platform.OS !== "web") {
  try {
    BarCodeScanner = require("expo-barcode-scanner").BarCodeScanner;
  } catch {
    BarCodeScanner = null;
  }
}
const NATIVE_SCAN = Platform.OS !== "web" && Boolean(BarCodeScanner);

function extractCode(payload: string): string {
  const m = payload.match(/(\d{6})/);
  return m ? m[1] : payload.trim();
}

export default function PairDeviceScreen({ route, navigation }: any) {
  const toast = useToast();
  const { children, reload } = useFamily();
  const preChild = route.params?.childId as string | undefined;

  const [childId, setChildId] = useState<string | undefined>(preChild ?? children[0]?.id);
  const [childPickerOpen, setChildPickerOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanPerm, setScanPerm] = useState<boolean | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      reload();
      navigation.goBack();
    }, 1300);
    return () => clearTimeout(t);
  }, [done, reload, navigation]);

  const canTgScan = canScanQr();

  async function openScanner() {
    if (canTgScan) {
      // Telegram's own full-screen camera scanner.
      const text = await scanQrWithTelegram("Farzand ilovasidagi QR-kodni skanerlang");
      if (text) await link(text);
      return;
    }
    if (NATIVE_SCAN) {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setScanPerm(status === "granted");
      scannedRef.current = false;
      setScanOpen(true);
      return;
    }
    toast.error("Skaner mavjud emas — kodni qo‘lda kiriting");
  }

  async function link(raw: string) {
    const value = extractCode(raw);
    if (!/^\d{6}$/.test(value)) {
      setError("6 xonali kodni kiriting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEnrollCode(value, childId);
      setScanOpen(false);
      setDone(true);
      toast.success("Qurilma ulandi");
    } catch (e: any) {
      setError(e?.message ?? "Kod tasdiqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  const child = children.find((c) => c.id === childId);

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.mintSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={28} color={colors.mint} />
          </View>
          <Text variant="h2">Qurilma ulandi</Text>
          <Muted>Faoliyat bir necha daqiqada ko‘rina boshlaydi.</Muted>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <Spino24Badge size={52} />
        <Text variant="h2" style={{ textAlign: "center" }}>
          Qurilmani ulang
        </Text>
        <Muted style={{ textAlign: "center" }}>
          Farzand kompyuteridagi Spino24 dasturi 6 xonali kod ko‘rsatadi.
        </Muted>
      </View>

      {children.length > 1 ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <ListRow
              first
              icon="user"
              title="Kimning qurilmasi?"
              subtitle={child?.name ?? "Tanlanmagan"}
              onPress={() => setChildPickerOpen(true)}
            />
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: 14 }}>
        <Text variant="h3">Kodni kiriting</Text>
        <Field
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          style={{ letterSpacing: 8, textAlign: "center", fontWeight: "800", fontSize: 20 }}
        />
        <ErrorText message={error} />
        <Button title="Tasdiqlash" onPress={() => link(code)} loading={busy} disabled={code.length < 6} />
        {canTgScan || NATIVE_SCAN ? (
          <Button title="QR-kodni skanerlash" variant="ghost" icon="qr" onPress={openScanner} />
        ) : null}
      </Card>

      <Sheet visible={childPickerOpen} onClose={() => setChildPickerOpen(false)} title="Farzandni tanlang" scroll={false}>
        <View>
          {children.map((c, i) => (
            <ListRow
              key={c.id}
              first={i === 0}
              title={c.name}
              right={childId === c.id ? <Icon name="check" size={18} color={colors.blue} /> : undefined}
              onPress={() => {
                setChildId(c.id);
                setChildPickerOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet visible={scanOpen} onClose={() => setScanOpen(false)} title="QR-kodni skanerlash" scroll={false}>
        {scanPerm && BarCodeScanner ? (
          <View style={{ height: 300, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#10233a" }}>
            <BarCodeScanner
              style={{ flex: 1 }}
              onBarCodeScanned={
                scannedRef.current
                  ? undefined
                  : ({ data }: { data: string }) => {
                      scannedRef.current = true;
                      link(data);
                    }
              }
            />
          </View>
        ) : (
          <View style={{ gap: 10, paddingVertical: 12 }}>
            <Text variant="label">Kameraga ruxsat kerak</Text>
            <Muted>QR-kodni skanerlash uchun kameraga ruxsat bering yoki kodni qo‘lda kiriting.</Muted>
            <Button title="Ruxsat so‘rash" variant="secondary" onPress={openScanner} />
          </View>
        )}
        <ErrorText message={error} />
      </Sheet>
    </Screen>
  );
}
