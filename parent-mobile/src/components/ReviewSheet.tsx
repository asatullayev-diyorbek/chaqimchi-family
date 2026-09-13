import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { colors } from "../theme";
import { submitReview } from "../api/feedback";
import { Button, Field, Muted, Text } from "./primitives";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

const RATING_LABELS: Record<number, string> = {
  1: "Yoqmadi",
  2: "O'rtacha",
  3: "Yaxshi",
  4: "Zo'r",
  5: "A'lo!",
};

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={{ fontSize: 38, lineHeight: 44 }} color={n <= value ? colors.warning : colors.faint}>
            {n <= value ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Bottom-sheet review form — a parent can leave more than one over time
 * (after each update they try, say), so this always opens blank rather
 * than loading and editing a single "current" review.
 */
export function ReviewSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setRating(0);
    setComment("");
  }

  async function handleSubmit() {
    if (rating < 1) {
      toast.error("Yulduzcha tanlang");
      return;
    }
    setBusy(true);
    try {
      await submitReview(rating, comment.trim());
      toast.success("Rahmat! Sharhingiz yuborildi");
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuborib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Spino24'ni baholang"
      scroll={false}
    >
      <View style={{ gap: 16, alignItems: "center" }}>
        <Muted style={{ textAlign: "center" }}>
          Fikringiz ilovani yaxshilashimizga yordam beradi.
        </Muted>

        <StarRow value={rating} onChange={setRating} />
        {rating > 0 ? (
          <Text variant="label" color={colors.warning}>
            {RATING_LABELS[rating]}
          </Text>
        ) : null}

        <Field
          placeholder="Izoh qoldiring (ixtiyoriy)"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: "top", width: "100%" }}
        />

        <Button title="📨 Yuborish" onPress={handleSubmit} loading={busy} disabled={rating < 1} />
      </View>
    </Sheet>
  );
}
