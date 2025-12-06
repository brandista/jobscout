import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

async function createAuthContext(openId: string): Promise<{ ctx: TrpcContext }> {
  // Create or get user from database
  const { upsertUser, getUserByOpenId } = await import("./db");
  await upsertUser({
    openId,
    name: `Test User ${openId}`,
    email: `${openId}@example.com`,
    loginMethod: "manus",
  });
  
  const dbUser = await getUserByOpenId(openId);
  if (!dbUser) throw new Error("Failed to create test user");
  
  const user: AuthenticatedUser = {
    id: dbUser.id,
    openId: dbUser.openId,
    email: dbUser.email || `${openId}@example.com`,
    name: dbUser.name || `Test User ${openId}`,
    loginMethod: dbUser.loginMethod || "manus",
    role: dbUser.role,
    createdAt: dbUser.createdAt,
    updatedAt: dbUser.updatedAt,
    lastSignedIn: dbUser.lastSignedIn,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("profile.upsert", () => {
  it("should create a new profile for user", async () => {
    const { ctx } = await createAuthContext("test-profile-create");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.upsert({
      currentTitle: "Software Developer",
      yearsOfExperience: 5,
      skills: ["JavaScript", "TypeScript", "React"],
      preferredJobTitles: ["Full Stack Developer", "Frontend Developer"],
      preferredLocations: ["Helsinki", "Espoo"],
      salaryMin: 4000,
      salaryMax: 6000,
      remotePreference: "hybrid",
    });

    expect(result).toEqual({ success: true });
  });

  it("should update existing profile", async () => {
    const { ctx } = await createAuthContext("test-profile-update");
    const caller = appRouter.createCaller(ctx);

    // Create initial profile
    await caller.profile.upsert({
      currentTitle: "Junior Developer",
      yearsOfExperience: 2,
    });

    // Update profile
    const result = await caller.profile.upsert({
      currentTitle: "Senior Developer",
      yearsOfExperience: 7,
    });

    expect(result).toEqual({ success: true });

    // Verify update
    const profile = await caller.profile.get();
    expect(profile?.currentTitle).toBe("Senior Developer");
    expect(profile?.yearsOfExperience).toBe(7);
  });
});

describe("profile.get", () => {
  it("should return null for user without profile", async () => {
    const { ctx } = await createAuthContext("test-profile-none");
    const caller = appRouter.createCaller(ctx);

    const profile = await caller.profile.get();
    expect(profile).toBeUndefined();
  });

  it("should return profile for user with profile", async () => {
    const { ctx } = await createAuthContext("test-profile-get");
    const caller = appRouter.createCaller(ctx);

    // Create profile
    await caller.profile.upsert({
      currentTitle: "Test Developer",
      yearsOfExperience: 3,
      skills: ["Python", "Django"],
    });

    // Get profile
    const profile = await caller.profile.get();
    expect(profile).toBeDefined();
    expect(profile?.currentTitle).toBe("Test Developer");
    expect(profile?.yearsOfExperience).toBe(3);
  });
});
