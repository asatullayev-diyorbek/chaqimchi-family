import { appDisplay } from "@/lib/appDisplay";

type Props = {
  appId: string | null | undefined;
  appName?: string | null;
  /** data:image/png;base64,... from the backend, extracted from the exe */
  icon?: string | null;
  size?: number;
};

// Shows the real per-app icon when the agent has sent one, otherwise a
// category-coloured glyph. Keeps the visual language identical either way.
export default function AppIcon({ appId, appName, icon, size = 34 }: Props) {
  const d = appDisplay(appId, appName);
  const radius = Math.round(size * 0.29);

  // A <div>, not a <span>: several list layouts have a `.parent span { flex:1 }`
  // rule that would otherwise stretch the icon into a full-width pill.
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, minWidth: size, borderRadius: radius, objectFit: "contain", background: "#fff", flex: "0 0 auto" }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius,
        background: d.bg,
        color: d.color,
        flex: "0 0 auto",
      }}
    >
      <iconify-icon icon={d.categoryIcon} style={{ fontSize: Math.round(size * 0.52) }}></iconify-icon>
    </div>
  );
}
