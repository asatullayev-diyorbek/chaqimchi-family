import { BarCodeScanner } from "expo-barcode-scanner";
import React, { useEffect, useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { verifyCode } from "../../api/enroll";

function extractCode(qrPayload: string): string {
  // qr_payload looks like "chaqimchi://enroll?token=482913"
  const match = qrPayload.match(/token=(\d{6})/);
  return match ? match[1] : qrPayload;
}

export default function QRScanScreen({ navigation }: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"idle" | "linked" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setHasPermission(status === "granted")
    );
  }, []);

  useEffect(() => {
    if (status !== "linked") return;
    const timer = setTimeout(() => navigation.replace("Home"), 1200);
    return () => clearTimeout(timer);
  }, [status, navigation]);

  async function link(code: string) {
    try {
      await verifyCode(code);
      setStatus("linked");
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }

  function onBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    link(extractCode(data));
  }

  if (status === "linked") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 28 }}>✓ Bog'landi</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Qurilma qo'shish</Text>
      {hasPermission ? (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : onBarCodeScanned}
          style={{ height: 300 }}
        />
      ) : (
        <Text>Kamera ruxsati kerak</Text>
      )}
      <Text>Yoki 6 xonali kodni kiriting:</Text>
      <TextInput
        placeholder="482913"
        keyboardType="number-pad"
        maxLength={6}
        value={manualCode}
        onChangeText={setManualCode}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 }}
      />
      <Button title="Tasdiqlash" onPress={() => link(manualCode)} />
      {status === "error" && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
}
