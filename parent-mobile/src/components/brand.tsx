import React from "react";
import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";

// The Spino24 brand mark is a horizontal bubble-letter wordmark (green
// "Spino" + orange "24" + blue swoosh). Rendered from the raster asset.
const LOGO = require("../../assets/logo.png");
const RATIO = 760 / 252; // width / height of assets/logo.png

/** The Spino24 wordmark at a given width. Height is computed explicitly —
 *  relying on `aspectRatio` alone let the required image reserve its full
 *  intrinsic height and blow out the layout. */
export function Spino24Logo({
  width = 150,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      style={[{ width, height: Math.round(width / RATIO) }, style]}
      accessibilityLabel="Spino24"
    />
  );
}

// --- Back-compat aliases (existing screens pass a font-size-ish `size`) ---

/** Header / inline wordmark. */
export function Spino24Wordmark({ size = 22 }: { size?: number }) {
  return <Spino24Logo width={Math.round(size * 5)} />;
}

/** Hero logo moment (splash, auth). */
export function Spino24Badge({ size = 56 }: { size?: number }) {
  return <Spino24Logo width={Math.round(size * 3.4)} />;
}

/** Kept for API compatibility. */
export function Spino24Mark({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Spino24Logo width={Math.round(size * 2.8)} />
    </View>
  );
}
