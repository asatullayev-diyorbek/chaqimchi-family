import React, { useState } from "react";
import { View } from "react-native";
import { colors, spacing } from "../theme";
import { minutesToHM } from "../lib/format";
import { Sheet } from "./Sheet";
import { WheelColumn } from "./WheelPicker";
import { Button, Chip, Text } from "./primitives";

const HOURS = Array.from({ length: 13 }, (_, i) => i);
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PRESETS = [30, 60, 90, 120, 180, 240];

/**
 * Bottom-sheet duration picker (hours + minutes) with quick presets.
 * `initial` and the result are in minutes. Pass `allowZero` to let the user
 * clear a limit (0 → onSubmit(0)).
 */
export function DurationPickerSheet({
  visible,
  onClose,
  onSubmit,
  title,
  initial,
  allowZero = true,
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (minutes: number) => void;
  title: string;
  initial: number;
  allowZero?: boolean;
  loading?: boolean;
}) {
  const [h, setH] = useState(minutesToHM(initial).h);
  const [m, setM] = useState(roundToStep(minutesToHM(initial).m));

  React.useEffect(() => {
    if (visible) {
      setH(minutesToHM(initial).h);
      setM(roundToStep(minutesToHM(initial).m));
    }
  }, [visible, initial]);

  const total = h * 60 + m;

  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p}
              label={minutesToHM(p).h ? `${minutesToHM(p).h}s ${minutesToHM(p).m ? `${minutesToHM(p).m}d` : ""}`.trim() : `${p}d`}
              active={total === p}
              onPress={() => {
                setH(minutesToHM(p).h);
                setM(minutesToHM(p).m);
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <WheelColumn values={HOURS} value={h} onChange={setH} suffix="soat" />
          <WheelColumn values={MINS} value={m} onChange={setM} suffix="daq" />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={total === 0 ? "Limitni o‘chirish" : "Saqlash"}
            onPress={() => onSubmit(total)}
            loading={loading}
            disabled={total === 0 && !allowZero}
            variant={total === 0 ? "danger" : "primary"}
          />
          <Button title="Bekor qilish" onPress={onClose} variant="ghost" />
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Start/end time-of-day picker for quiet hours (bedtime / school time).
 * Values are "HH:MM" strings. A window that crosses midnight is fine.
 */
export function TimeRangePickerSheet({
  visible,
  onClose,
  onSubmit,
  title,
  initialStart = "22:00",
  initialEnd = "07:00",
  loading = false,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (start: string, end: string) => void;
  title: string;
  initialStart?: string;
  initialEnd?: string;
  loading?: boolean;
}) {
  const [s, setS] = useState(parseHHMM(initialStart));
  const [e, setE] = useState(parseHHMM(initialEnd));

  React.useEffect(() => {
    if (visible) {
      setS(parseHHMM(initialStart));
      setE(parseHHMM(initialEnd));
    }
  }, [visible, initialStart, initialEnd]);

  const allHours = Array.from({ length: 24 }, (_, i) => i);
  const same = s.h === e.h && s.m === e.m;

  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: "row", gap: spacing.lg }}>
          <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <Text variant="label" color={colors.muted}>
              Boshlanish
            </Text>
            <View style={{ flexDirection: "row" }}>
              <WheelColumn values={allHours} value={s.h} onChange={(h) => setS({ ...s, h })} width={56} />
              <WheelColumn values={MINS} value={s.m} onChange={(m) => setS({ ...s, m })} width={56} />
            </View>
          </View>
          <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <Text variant="label" color={colors.muted}>
              Tugash
            </Text>
            <View style={{ flexDirection: "row" }}>
              <WheelColumn values={allHours} value={e.h} onChange={(h) => setE({ ...e, h })} width={56} />
              <WheelColumn values={MINS} value={e.m} onChange={(m) => setE({ ...e, m })} width={56} />
            </View>
          </View>
        </View>
        {same ? (
          <Text variant="caption" color={colors.danger}>
            Boshlanish va tugash vaqti bir xil bo‘lmasligi kerak.
          </Text>
        ) : null}
        <Button
          title="Saqlash"
          onPress={() => onSubmit(fmt(s), fmt(e))}
          loading={loading}
          disabled={same}
        />
      </View>
    </Sheet>
  );
}

function roundToStep(m: number): number {
  return MINS.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), 0);
}
function parseHHMM(v: string): { h: number; m: number } {
  const [h, m] = v.split(":").map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 22, m: roundToStep(Number.isFinite(m) ? m : 0) };
}
function fmt({ h, m }: { h: number; m: number }): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
