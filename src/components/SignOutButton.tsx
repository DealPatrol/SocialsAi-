"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-xs text-gray-500 hover:text-white"
    >
      Sign out
    </button>
  );
}
