"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteProject } from "./storage";

/**
 * 删除一个项目（不可逆）。删除当前打开的项目时回到首页，否则原地刷新列表。
 * 二次确认在客户端按钮处完成（confirm），server 侧只做删除 + revalidate。
 */
export async function deleteProjectAction(projectId: string, isCurrent: boolean): Promise<void> {
  await deleteProject(projectId);
  // layout 级 revalidate：同时刷新首页项目列表与工作区侧栏。
  revalidatePath("/", "layout");
  if (isCurrent) {
    redirect("/");
  }
}
