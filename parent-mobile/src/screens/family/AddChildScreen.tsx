import React, { useState } from "react";
import { Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, radius } from "../../theme";
import { createChild, ImageFile } from "../../api/children";
import { useFamily } from "../../state/family";
import { Button, Card, ErrorText, Field, Icon, Muted, Screen, Text, useToast } from "../../components";

export default function AddChildScreen({ navigation }: any) {
  const toast = useToast();
  const { reload } = useFamily();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [photo, setPhoto] = useState<ImageFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Galereyaga ruxsat berilmadi");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const ext = (a.uri.split(".").pop() || "jpg").toLowerCase();
      setPhoto({
        uri: a.uri,
        name: `child.${ext}`,
        type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
      });
    }
  }

  function validBirthDate(v: string): boolean {
    return v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  async function submit() {
    if (busy) return;
    if (!name.trim()) {
      setError("Farzand ismini kiriting.");
      return;
    }
    if (!validBirthDate(birthDate.trim())) {
      setError("Tug‘ilgan sana YYYY-MM-DD ko‘rinishida bo‘lsin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createChild({
        name: name.trim(),
        birth_date: birthDate.trim() || undefined,
        photo,
      });
      await reload();
      toast.success("Farzand qo‘shildi");
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Card style={{ gap: 16 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Pressable onPress={pickPhoto}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: colors.blueSoft,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {photo ? (
                <Image source={{ uri: photo.uri }} style={{ width: 88, height: 88 }} />
              ) : (
                <Icon name="camera" size={24} color={colors.blue} />
              )}
            </View>
          </Pressable>
          <Muted>Rasm (ixtiyoriy)</Muted>
        </View>

        <Field label="Ism" value={name} onChangeText={setName} placeholder="Masalan: Ali" />
        <Field
          label="Tug‘ilgan sana (ixtiyoriy)"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="2014-05-20"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <ErrorText message={error} />
        <Button title="Saqlash" onPress={submit} loading={busy} />
      </Card>
      <Muted style={{ textAlign: "center" }}>
        Saqlangandan so‘ng farzand qurilmasini 6 xonali kod bilan ulaysiz.
      </Muted>
    </Screen>
  );
}
