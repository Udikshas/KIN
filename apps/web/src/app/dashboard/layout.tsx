import type { Metadata } from "next";

import { Shell } from "@/components/dashboard/shell";
import { KinProvider } from "@/lib/kin/kin";

export const metadata: Metadata = {
  title: "Kin · Family dashboard",
  description: "Your parent's calls, trends, medicines and groceries, on a bigger screen. Same account as the Kin app.",
  robots: { index: false },
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <KinProvider>
      <Shell>{children}</Shell>
    </KinProvider>
  );
}
