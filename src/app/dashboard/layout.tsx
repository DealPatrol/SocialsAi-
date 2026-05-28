import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import SignOutButton from "@/components/SignOutButton";

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
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              SocialsAI
            </p>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400">{session.user.email}</p>
          </div>
          <SignOutButton />
        </div>
        <DashboardNav />
        {children}
      </div>
    </main>
  );
}
