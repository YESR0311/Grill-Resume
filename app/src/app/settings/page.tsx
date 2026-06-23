import {
  listConnections,
  listSearchProviders,
  getRouting,
  saveConnection,
  deleteConnection,
  saveSearchProvider,
  deleteSearchProvider,
  setTaskRoute,
} from "@/features/settings/store";
import { SEARCH_KINDS } from "@/features/settings/types";
import { TestConnectionButton } from "@/components/settings/TestConnectionButton";
import { ThemeToggleClient } from "./ThemeToggleClient";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const connections = await Promise.resolve().then(() => listConnections());
  const searchProviders = await Promise.resolve().then(() => listSearchProviders());
  const routing = await Promise.resolve().then(() => getRouting());

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* ─── 返回 ─────────────────────────── */}
          <SettingsBackButton />

          {/* ─── 主题 ─────────────────────────── */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
            <h1 className="text-xl font-semibold">外观</h1>
            <p className="mt-1 text-sm text-muted-foreground">切换浅色 / 暗色 / 跟随系统。</p>
            <div className="mt-4">
              <ThemeToggleClient />
            </div>
          </section>

          {/* ─── AI 连接 ─────────────────────────────── */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
            <h2 className="text-xl font-semibold">AI 连接</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置 AI 模型的 Base URL 和 API Key。
            </p>
            <ConnectionForm />
            {connections.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">已保存的连接</p>
                {connections.map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{conn.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {conn.baseUrl} · {conn.model} · {conn.hasApiKey ? "已配置 Key" : "无 Key"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <TestConnectionButton connectionId={conn.id} />
                      <form action={deleteConnectionAction}>
                        <input type="hidden" name="id" value={conn.id} />
                        <button className="text-xs text-status-failed hover:underline">删除</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── 任务路由 ─────────────────────────────── */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
            <h2 className="text-xl font-semibold">任务路由</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              指定每步由哪个连接和模型执行。未配置则使用默认连接。
            </p>
            <div className="mt-4 space-y-3">
              {(["intake", "evaluate", "polish"] as const).map((task) => {
                const labels: Record<string, string> = {
                  intake: "问答",
                  evaluate: "评估",
                  polish: "润色",
                };
                const route = routing[task];
                return (
                  <div key={task} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{labels[task] ?? task}</p>
                    <form action={setTaskRouteAction} className="flex items-center gap-2">
                      <input type="hidden" name="task" value={task} />
                      <select
                        name="connectionId"
                        defaultValue={route?.connectionId ?? ""}
                        className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">默认连接</option>
                        {connections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        name="model"
                        defaultValue={route?.model ?? ""}
                        placeholder="模型名"
                        className="w-32 rounded-lg border border-input bg-background px-2 py-1 text-xs"
                      />
                      <button className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">应用</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── 搜索渠道 ─────────────────────────────── */}
          <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
            <h2 className="text-xl font-semibold">搜索渠道</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置联网搜索 API Key（Base URL 已内置）。评估后台会自动使用启用的渠道。
            </p>
          <SearchProviderForm />
          {searchProviders.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">已保存的搜索</p>
              {searchProviders.map((sp) => (
                <div key={sp.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{sp.kind.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {sp.hasApiKey ? "已配置 Key" : "无 Key"}
                      {sp.enabled ? " · 启用" : " · 禁用"}
                    </p>
                  </div>
                  <form action={deleteSearchAction}>
                    <input type="hidden" name="id" value={sp.id} />
                    <button className="text-xs text-status-failed hover:underline">删除</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  </main>
  );
}

// ─── Server Actions ──────────────────────────────────────

async function saveConnectionAction(formData: FormData) {
  "use server";
  await saveConnection({
    name: String(formData.get("name") ?? ""),
    baseUrl: String(formData.get("baseUrl") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    model: String(formData.get("model") ?? ""),
    isDefault: false,
  });
  revalidatePath("/settings");
}

async function deleteConnectionAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (id) deleteConnection(id);
  revalidatePath("/settings");
}

async function setTaskRouteAction(formData: FormData) {
  "use server";
  const task = String(formData.get("task") ?? "") as "intake" | "evaluate" | "polish";
  const connectionId = String(formData.get("connectionId") ?? "");
  const model = String(formData.get("model") ?? "").trim();
  if (connectionId) {
    setTaskRoute(task, { connectionId, model: model || undefined });
  } else {
    setTaskRoute(task, null);
  }
  revalidatePath("/settings");
}

async function saveSearchAction(formData: FormData) {
  "use server";
  const kind = String(formData.get("kind") ?? "");
  saveSearchProvider({
    kind: SEARCH_KINDS.includes(kind as never) ? (kind as "tavily" | "exa") : "tavily",
    apiKey: String(formData.get("apiKey") ?? ""),
    enabled: String(formData.get("enabled") ?? "") === "on",
  });
  revalidatePath("/settings");
}

async function deleteSearchAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (id) deleteSearchProvider(id);
  revalidatePath("/settings");
}

// ─── 表单组件 ────────────────────────────────────────────

async function ConnectionForm() {
  return (
    <form action={saveConnectionAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input name="name" placeholder="名称（如 DeepSeek / OpenRouter）" required className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      <input name="model" placeholder="默认模型（如 deepseek-chat）" required className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      <input name="baseUrl" placeholder="Base URL（如 https://api.deepseek.com/v1）" required className="col-span-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      <input name="apiKey" type="password" placeholder="API Key" required className="col-span-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      <button className="col-span-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        保存连接
      </button>
    </form>
  );
}

async function SearchProviderForm() {
  return (
    <form action={saveSearchAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <select name="kind" className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
        <option value="tavily">Tavily</option>
        <option value="exa">EXA</option>
      </select>
      <input name="apiKey" type="password" placeholder="API Key" required className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      <label className="col-span-full flex items-center gap-2 text-sm">
        <input name="enabled" type="checkbox" defaultChecked className="rounded" />
        启用
      </label>
      <button className="col-span-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        保存搜索渠道
      </button>
    </form>
  );
}

// ─── 返回按钮（client component，router.back） ────────
import { SettingsBackButton } from "./SettingsBackButton";