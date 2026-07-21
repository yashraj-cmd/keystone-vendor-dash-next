import { NextResponse } from "next/server";
import { HttpError } from "./auth";

/**
 * Wrap a route-handler body: returns its value as JSON, and converts thrown
 * HttpErrors into the right status code (everything else → 500).
 */
export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { success: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json(
        { statusCode: err.status, message: err.message },
        { status: err.status },
      );
    }
    console.error("[api error]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ statusCode: 500, message }, { status: 500 });
  }
}
