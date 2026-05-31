"use client";

import { signOut } from "next-auth/react";
import ShimmerButton from "@/components/premium/ShimmerButton";

export default function SignOutButton() {
  return (
    <ShimmerButton
      type="button"
      variant="ghost"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="!text-xs"
    >
      Sign out
    </ShimmerButton>
  );
}
