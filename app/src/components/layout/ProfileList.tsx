import Link from "next/link";
import { User } from "lucide-react";
import { listProfiles } from "@/features/profile/store";

/**
 * 首页侧边栏：已有档案列表（Server Component）
 *
 * 显示前 8 个档案，超出显示"查看全部"链接
 * 每个档案显示姓名 + 职位（如有）
 */
export function ProfileList() {
  const profiles = listProfiles();
  const displayProfiles = profiles.slice(0, 8);
  const hasMore = profiles.length > 8;

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      <div className="border-b border-warm-hairline px-6 py-4">
        <h2 className="font-display text-lg font-medium text-ink">我的档案</h2>
      </div>

      {/* 档案列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayProfiles.length === 0 ? (
          <p className="px-2 text-sm text-muted-text">暂无档案</p>
        ) : (
          <div className="space-y-2">
            {displayProfiles.map((profile) => (
              <Link
                key={profile.id}
                href={`/profile/${profile.id}`}
                className="block rounded-lg border border-warm-hairline bg-surface-white p-3 transition-all hover:border-terracotta hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-terracotta-tint">
                    <User size={16} className="text-terracotta" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {profile.name || "未命名"}
                    </p>
                    {profile.title && (
                      <p className="mt-0.5 truncate text-xs text-muted-text">
                        {profile.title}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {hasMore && (
          <Link
            href="/profiles"
            className="mt-4 block rounded-lg border border-warm-hairline bg-surface-white px-4 py-2.5 text-center text-sm text-terracotta transition-colors hover:bg-terracotta-tint"
          >
            查看全部 ({profiles.length} 个档案)
          </Link>
        )}
      </div>

      {/* 新建档案按钮 */}
      <div className="border-t border-warm-hairline p-4">
        <Link
          href="/intake"
          className="btn btn-primary block w-full text-center"
        >
          + 新建档案
        </Link>
      </div>
    </div>
  );
}
