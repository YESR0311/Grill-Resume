import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { createProfile } from "@/features/profile/store";

export const dynamic = "force-dynamic";

export default async function IntakeNewPage() {
  const id = nanoid(10);
  createProfile({ id });
  redirect(`/intake/${id}`);
}