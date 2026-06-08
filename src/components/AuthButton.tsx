"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm">
          <p className="font-medium text-white">
            {session.user?.name || "User"}
          </p>
          <p className="text-xs text-gray-400">@{session.user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white transition"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("twitter")}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition"
    >
      Login with Twitter
    </button>
  );
}
