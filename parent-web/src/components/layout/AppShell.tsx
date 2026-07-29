import Header from "./Header";
import Sidebar from "./Sidebar";

// Fixed-height outer frame (not minHeight) with two independently-scrolling
// children: the sidebar never scrolls, only `main` does. This is the
// explicit fix for "sidebar must stay in place when the screen scrolls" —
// previously Sidebar was a plain flex child with minHeight:100vh, so it
// scrolled away with the rest of the page on any content taller than the
// viewport.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100vh",
        maxWidth: 1400,
        margin: "0 auto",
        padding: 20,
        display: "flex",
        gap: 16,
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Header />
        <main style={{ flex: 1, overflowY: "auto", padding: "20px 4px 20px 4px" }}>{children}</main>
      </div>
    </div>
  );
}
