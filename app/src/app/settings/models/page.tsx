import Link from "next/link";
import { redirect } from "next/navigation";
import { listModelConfigs, saveOpenAICompatibleConfig } from "@/features/ai/model-configs";

export const dynamic = "force-dynamic";

async function saveModelConfigAction(formData: FormData) {
  "use server";

  await saveOpenAICompatibleConfig({
    name: String(formData.get("name") ?? ""),
    baseUrl: String(formData.get("baseUrl") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    model: String(formData.get("model") ?? ""),
    isDefault: true,
  });
  redirect("/settings/models");
}

export default async function ModelSettingsPage() {
  const configs = await listModelConfigs();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← 返回仪表盘
        </Link>

        <section className="rounded-3xl bg-card p-8 shadow-sm ring-1 ring-border">
          <p className="text-sm text-muted-foreground">模型设置</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">OpenAI 兼容服务商</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            API Key 加密保存在本机设置目录。AI 请求会发送到你配置的基础地址（Base URL）。
          </p>
          <Link href="/settings/search" className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground">
            配置 Tavily 搜索
          </Link>
        </section>

        <form action={saveModelConfigAction} className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
          <h2 className="text-xl font-semibold">新增默认模型</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-foreground">
              配置名称
              <input name="name" placeholder="DeepSeek / OpenRouter" className="mt-2 w-full rounded-xl border border-input px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-foreground">
              模型
              <input name="model" required placeholder="deepseek-chat" className="mt-2 w-full rounded-xl border border-input px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-foreground sm:col-span-2">
              基础地址 (Base URL)
              <input name="baseUrl" required placeholder="https://api.deepseek.com/v1" className="mt-2 w-full rounded-xl border border-input px-3 py-2" />
            </label>
            <label className="text-sm font-medium text-foreground sm:col-span-2">
              API Key
              <input name="apiKey" required type="password" className="mt-2 w-full rounded-xl border border-input px-3 py-2" />
            </label>
          </div>
          <button className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            保存为默认模型
          </button>
        </form>

        <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
          <h2 className="text-xl font-semibold">已保存配置</h2>
          {configs.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">尚未配置模型。生成草稿前需先保存一个默认模型。</p>
          ) : (
            <ul className="mt-5 divide-y divide-border text-sm text-muted-foreground">
              {configs.map((config) => (
                <li key={config.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{config.name}</p>
                    <p className="mt-1">{config.baseUrl} · {config.model}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {config.isDefault ? "默认" : "备用"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
