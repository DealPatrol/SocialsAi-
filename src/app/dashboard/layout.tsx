import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

  return (
    <DashboardChrome email={session.user.email ?? ""}>
      {children}
    </DashboardChrome>
  );
}
