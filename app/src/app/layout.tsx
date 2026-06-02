import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "中文简历工坊",
  description: "本地优先的中文求职简历制作工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-950">{children}</body>
    </html>
  );
}
