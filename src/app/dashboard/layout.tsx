import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import DashboardChrome from "@/components/premium/DashboardChrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  await ensureDb();
  const [user] = await db
    .select({ onboardingComplete: users.onboardingComplete })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (user && !user.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <DashboardChrome email={session.user.email ?? ""}>
      {children}
    </DashboardChrome>
  );
}
