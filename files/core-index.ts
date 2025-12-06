import "dotenv/config";
import { runMigrations } from "../migrate";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Run database migrations first
  await runMigrations();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Auto Scout cron job - runs every hour to check for due scouts
  startAutoScoutCron();

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`JobScout server running on http://localhost:${port}/`);
  });
}

// Auto Scout background job
async function startAutoScoutCron() {
  const CRON_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  console.log("[AutoScout] Cron job started, checking every hour");

  const runAutoScouts = async () => {
    try {
      const { getAutoScoutSettingsDueForRun, updateAutoScoutLastRun, getProfileByUserId, getUserById } = await import("../db");
      const { scoutJobs } = await import("../scout");
      const { sendJobAlertEmail } = await import("../email");

      const dueSettings = await getAutoScoutSettingsDueForRun();
      
      if (dueSettings.length === 0) {
        return;
      }

      console.log(`[AutoScout] Found ${dueSettings.length} due scouts to run`);

      for (const settings of dueSettings) {
        try {
          const profile = await getProfileByUserId(settings.userId);
          if (!profile) {
            console.log(`[AutoScout] No profile for user ${settings.userId}, skipping`);
            continue;
          }

          const user = await getUserById(settings.userId);
          const sources = settings.sources ? JSON.parse(settings.sources) : ["google_jobs"];
          
          console.log(`[AutoScout] Running scout for user ${settings.userId}`);
          const results = await scoutJobs({ profile, sources, maxResults: 20 });
          const allJobs = results.flatMap(r => r.jobs);

          console.log(`[AutoScout] Found ${allJobs.length} jobs for user ${settings.userId}`);

          // Send email if enabled and jobs found
          if (allJobs.length > 0 && settings.emailEnabled === 1 && settings.emailAddress) {
            await sendJobAlertEmail({
              recipientEmail: settings.emailAddress,
              recipientName: user?.name || undefined,
              jobs: allJobs.slice(0, 10).map(j => ({
                title: j.title || "Työpaikka",
                company: j.company || "Yritys",
                location: j.location || "",
                url: j.url || "",
              })),
              totalJobs: allJobs.length,
              newMatches: allJobs.length,
            });
            console.log(`[AutoScout] Email sent to ${settings.emailAddress}`);
          }

          // Update last run time
          await updateAutoScoutLastRun(settings.id, settings.frequency);
          
        } catch (error) {
          console.error(`[AutoScout] Error for user ${settings.userId}:`, error);
        }
      }
    } catch (error) {
      console.error("[AutoScout] Cron error:", error);
    }
  };

  // Run immediately on startup, then every hour
  setTimeout(runAutoScouts, 10000); // Wait 10s after startup
  setInterval(runAutoScouts, CRON_INTERVAL);
}

startServer().catch(console.error);
