import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { startBackgroundProcessor } from "./ai/backgroundProcessor";
import { seedBuiltinSkills } from "./ai/skillsLibrary";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Server error:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  const port = 3001;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    
    // Start background processor for automatic data processing
    startBackgroundProcessor();

    // Seed built-in skills (idempotent)
    seedBuiltinSkills().catch(err => console.error('[Skills] Seeding failed:', err));
  });
})();
