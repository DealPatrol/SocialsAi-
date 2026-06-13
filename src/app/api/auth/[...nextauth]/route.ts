import { handlers, auth } from "@/lib/auth";

// During build time, handlers might be undefined if env vars are missing
// This is fine - at runtime (production), these will always be defined
export const GET = handlers?.GET || (() => new Response("Auth not configured", { status: 500 }));
export const POST = handlers?.POST || (() => new Response("Auth not configured", { status: 500 }));
