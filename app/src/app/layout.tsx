import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "中文简历工坊",
  description: "本地优先的中文求职简历制作工具：录入 → 追问 → 评估 → 润色 → 导出",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`h-full ${playfairDisplay.variable} ${inter.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          防闪烁 inline script：在浏览器 CSSOM 构建前按 localStorage 设 class。
          "system" 时监听 prefers-color-scheme；不依赖 React 水合。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){try{
  var t=localStorage.getItem("theme")||"system";
  if(t==="dark"){document.documentElement.classList.add("dark");return;}
  if(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)
    {document.documentElement.classList.add("dark");}
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}