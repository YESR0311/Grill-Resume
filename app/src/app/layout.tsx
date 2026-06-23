import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { Playfair_Display, Inter } from "next/font/google";
import Script from "next/script";
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
  title: "问答式简历生成器",
  description: "AI 驱动的简历制作工具：智能追问采集 → 评估反馈优化 → 专业润色编辑 → Word 导出",
};

const themeBootstrap = `(function(){try{
  var t=localStorage.getItem("theme")||"system";
  if(t==="dark"){document.documentElement.classList.add("dark");return;}
  if(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)
    {document.documentElement.classList.add("dark");}
}catch(e){}})();`;

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
          用 next/script 的 beforeInteractive 策略注入到 <head>，
          React 不会把它当组件树节点，且会在 CSSOM 前同步执行。
        */}
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
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