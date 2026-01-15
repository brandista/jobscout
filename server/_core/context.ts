import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyGoogleToken } from "./google-auth";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Get access token from Authorization header
    const authHeader = opts.req.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    if (accessToken) {
      const googleUser = await verifyGoogleToken(accessToken);

      if (googleUser) {
        // Sync user to database
        await db.upsertUser({
          openId: googleUser.id, // Using Google user ID as openId
          email: googleUser.email,
          name: googleUser.name,
          lastSignedIn: new Date(),
        });

        user = await db.getUserByOpenId(googleUser.id);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    console.warn('[Auth] Context creation error:', error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
