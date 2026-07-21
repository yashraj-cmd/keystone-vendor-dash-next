import { handle } from "@/lib/server/http";

// Stateless JWT — logout is handled client-side by discarding the tokens.
// Endpoint exists so the client has something to call.
export async function POST() {
  return handle(async () => ({ success: true }));
}
