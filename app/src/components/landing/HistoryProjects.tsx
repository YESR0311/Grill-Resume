"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Trash2, Plus, Clock } from "lucide-react";
import type { PersonProfile } from "@/features/profile/types";
import { Button } from "@/components/ui/button";

interface HistoryProjectsProps {
  profiles: PersonProfile[];
}

export function HistoryProjects({ profiles }: HistoryProjectsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (profiles.length === 0) {
    return null;
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("确定要删除这个项目吗？")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/profile/${id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-medium text-foreground">历史项目</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-terracotta hover:shadow-md"
          >
            <Link href={`/profile/${profile.id}`} className="block">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-tint">
                  <User size={18} className="text-terracotta" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {profile.name || "未命名项目"}
                  </p>
                  {profile.title && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {profile.title}
                    </p>
                  )}
                  {profile.updatedAt && (
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      {profile.updatedAt.slice(0, 10)}
                    </p>
                  )}
                </div>
              </div>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => handleDelete(profile.id, e)}
              disabled={deletingId === profile.id}
              title="删除项目"
            >
              <Trash2 size={14} className="text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 新建项目按钮组件
 */
export function NewProjectButton() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-4">
      <Link href="/intake">
        <Button className="w-full gap-2 py-6 text-base">
          <Plus className="h-5 w-5" />
          新建简历项目
        </Button>
      </Link>
    </div>
  );
}
