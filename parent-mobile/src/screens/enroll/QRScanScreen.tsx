import { BarCodeScanner } from "expo-barcode-scanner";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { verifyCode } from "../../api/enroll";
import { Card, ErrorText, Field, PrimaryButton, SecondaryButton, colors, Screen } from "../../ui";

function extractCode(qrPayload: string): string {
  const match = qrPayload.match(/token=(\d{6})/);
  return match ? match[1] : qrPayload;
}

export default function QRScanScreen({ navigation }: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"idle" | "linked" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { BarCodeScanner.requestPermissionsAsync().then(({ status }) => setHasPermission(status === "granted")); }, []);
  useEffect(() => { if (status !== "linked") return; const timer = setTimeout(() => navigation.replace("Home"), 1200); return () => clearTimeout(timer); }, [status, navigation]);

  async function link(code: string) {
    if (!code.trim()) return setError("Olti xonali kodni kiriting.");
    try { setError(null); await verifyCode(code); setStatus("linked"); } catch (e: any) { setError(e.message); setStatus("error"); }
  }
  function onBarCodeScanned({ data }: { data: string }) { if (!scanned) { setScanned(true); link(extractCode(data)); } }

  if (status === "linked") return <Screen><View style={{ flex: 1, justifyContent: "center" }}><Card style={{ alignItems: "center", gap: 12, paddingVertical: 38 }}><View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.mintSoft }}><Text style={{ fontSize: 29, color: colors.mint }}>✓</Text></View><Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Qurilma bog‘landi</Text><Text style={{ color: colors.muted }}>Bosh sahifaga o‘tyapmiz…</Text></Card></View></Screen>;

  return <Screen scroll><View style={{ gap: 16 }}>
    <View style={{ gap: 4 }}><Text style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>Child qurilmasini ulang</Text><Text style={{ color: colors.muted, lineHeight: 21 }}>Child ilovada paydo bo‘lgan QR-kodni skanerlang yoki olti xonali kodni kiriting.</Text></View>
    <Card style={{ gap: 12 }}>
      {hasPermission ? <View style={{ overflow: "hidden", borderRadius: 15, height: 280, backgroundColor: "#10233a" }}><BarCodeScanner onBarCodeScanned={scanned ? undefined : onBarCodeScanned} style={{ flex: 1 }} /></View> : <View style={{ gap: 10, paddingVertical: 16 }}><Text style={{ color: colors.text, fontWeight: "700" }}>Kamera ruxsati kerak</Text><Text style={{ color: colors.muted }}>QR-kodni skanerlash uchun kameraga ruxsat bering yoki kodni qo‘lda kiriting.</Text><SecondaryButton title="Ruxsatni qayta so‘rash" onPress={() => BarCodeScanner.requestPermissionsAsync().then(({ status }) => setHasPermission(status === "granted"))} /></View>}
      {scanned && <SecondaryButton title="Qayta skanerlash" onPress={() => setScanned(false)} />}
    </Card>
    <Card style={{ gap: 12 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Kod bilan ulash</Text><Field placeholder="123456" keyboardType="number-pad" maxLength={6} value={manualCode} onChangeText={setManualCode} style={{ textAlign: "center", letterSpacing: 7, fontWeight: "800", fontSize: 19 }} /><ErrorText message={error} /><PrimaryButton title="Tasdiqlash" onPress={() => link(manualCode)} /></Card>
  </View></Screen>;
}
