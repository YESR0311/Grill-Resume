"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

/**
 * 首页 Hero 区域
 * 突出 AI 简历制作的核心价值主张
 */
export function HomeHero() {
  return (
    <div className="relative flex flex-col items-center justify-center px-8 py-16 text-center">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-terracotta/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-terracotta/5 blur-3xl" />
      </div>

      {/* 主标题 */}
      <h1 className="relative mb-2 font-display text-5xl font-medium tracking-tight text-foreground md:text-6xl">
        问答式简历生成器
      </h1>

      {/* 英文副标题 */}
      <p className="relative mb-8 text-lg text-muted-foreground/70 md:text-xl font-light tracking-wide">
        Grill-Resume
      </p>

      {/* CTA 按钮 */}
      <Link
        href="/intake"
        className="btn btn-primary relative px-10 py-4 text-base"
      >
        <MessageSquare className="mr-2 h-5 w-5" />
        开始制作简历
      </Link>

      {/* 底部说明 */}
      <p className="relative mt-6 text-sm text-muted-foreground">
        无需填写表格 · AI 引导式采集 · 仅支持 Word 导出
      </p>
    </div>
  );
}
