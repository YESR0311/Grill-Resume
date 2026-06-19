import Link from "next/link";
import { redirect } from "next/navigation";
import { getTavilyConfigSummary, saveTavilyConfig } from "@/features/search/settings";
import { TavilySearchProvider } from "@/features/search/tavily";

export const dynamic = "force-dynamic";

async function saveTavilyAction(formData: FormData) {
  "use server";

  const summary = await saveTavilyConfig({
    name: String(formData.get("name") ?? "Tavily"),
    baseUrl: String(formData.get("baseUrl") ?? "https://api.tavily.com"),
    apiKey: String(formData.get("apiKey") ?? ""),
    freeTier: String(formData.get("freeTier") ?? "") === "on",
    monthlyQuota: Number.parseInt(String(formData.get("monthlyQuota") ?? ""), 10) || undefined,
  });

  const config = await import("@/features/search/settings").then((mod) => mod.getTavilyConfig());
  if (!config) redirect("/settings/search?status=error");

  try {
    await new TavilySearchProvider(config).query({ query: "test query", maxResults: 1 });
    redirect(`/settings/search?status=test-ok&id=${summary.id}`);
  } catch {
    redirect(`/settings/search?status=saved-test-failed&id=${summary.id}`);
  }
}

export default async function SearchSettingsPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  const query = (await searchParams) ?? {};
  const config = await getTavilyConfigSummary();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">← 返回仪表盘</Link>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">搜索设置</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tavily 搜索服务</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">API Key 加密保存在本机设置目录。保存后只发起一次测试请求。</p>
          {query.status === "test-ok" ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">Tavily 测试成功。</p> : null}
          {query.status === "saved-test-failed" ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">配置已保存，但测试请求失败；后续搜索会失败时拒绝外发（fail-closed）。</p> : null}
          {query.status === "error" ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">配置保存失败。</p> : null}
        </section>

        <form action={saveTavilyAction} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">保存 Tavily 配置</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              配置名称
              <input name="name" defaultValue={config?.name ?? "Tavily"} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              月度软上限
              <input name="monthlyQuota" type="number" min="1" defaultValue={config?.monthlyQuota ?? 1000} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              基础地址 (Base URL)
              <input name="baseUrl" required defaultValue={config?.baseUrl ?? "https://api.tavily.com"} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              API Key
              <input name="apiKey" required type="password" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input name="freeTier" type="checkbox" defaultChecked={config?.freeTier ?? true} />
              免费额度模式
            </label>
          </div>
          <button className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">保存并测试</button>
        </form>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">当前配置</h2>
          {config ? (
            <div className="mt-5 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{config.name}</p>
              <p className="mt-1">{config.baseUrl} · {config.freeTier ? "免费额度" : "自定义额度"}</p>
              <p className="mt-1">API Key：{config.hasApiKey ? "已保存" : "未保存"}</p>
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">尚未配置 Tavily。</p>}
        </section>
      </div>
    </main>
  );
}
