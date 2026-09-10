import type { Metadata } from "next";
import DownloadClient from "./DownloadClient";

export const metadata: Metadata = {
  title: "Yuklab olish — Spino24",
  description: "Spino24 Windows dasturini yuklab olish.",
};

export default function DownloadPage() {
  return <DownloadClient />;
}
