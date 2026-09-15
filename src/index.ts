import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
// Patches Express's router so rejected promises in async handlers reach the
// error middleware below instead of crashing the process (Express 4 doesn't
// do this on its own — Express 5 does, this project isn't on it yet).
import "express-async-errors";
import { fail } from "./lib/response";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import divisiRoutes from "./routes/divisi";
import roleRoutes from "./routes/roles";
import pesertaMagangRoutes from "./routes/peserta-magang";
import absensiRoutes from "./routes/absensi";
import instansiRoutes from "./routes/instansi";
import logbookRoutes from "./routes/logbook";
import penilaianRoutes from "./routes/penilaian";
import dokumenRoutes from "./routes/dokumen";
import pesertaPortalRoutes from "./routes/peserta-portal";
import notificationsRoutes from "./routes/notifications";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  const { APP_TIMEZONE, CHECKOUT_AUTO_AT, todayIsoDate, nowJam } = await import("./lib/datetime");
  const timezone = APP_TIMEZONE;
  const time = nowJam();
  const today = todayIsoDate();
  const config = {
    jwtSecret: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
    databaseUrl: Boolean(process.env.DATABASE_URL),
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
    checkinStart: process.env.CHECKIN_START ?? "07:00",
    checkinEnd: process.env.CHECKIN_END ?? "09:00",
    checkoutAutoAt: CHECKOUT_AUTO_AT,
  };

  try {
    const { default: prisma } = await import("./lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true, timezone, time, today, config });
  } catch {
    // 503 when DB is unreachable (common after free-tier Supabase pause).
    res.status(503).json({ ok: false, db: false, timezone, time, today, config });
  }
});

app.use(authRoutes);
app.use("/users", userRoutes);
app.use("/divisi", divisiRoutes);
app.use("/roles", roleRoutes);
app.use("/peserta-magang", pesertaMagangRoutes);
app.use("/absensi", absensiRoutes);
app.use("/instansi", instansiRoutes);
app.use("/logbook", logbookRoutes);
app.use("/penilaian", penilaianRoutes);
app.use("/dokumen", dokumenRoutes);
app.use("/notifications", notificationsRoutes);
// Portal peserta magang — its own auth middleware and token audience, kept
// separate from every staff route above.
app.use("/portal", pesertaPortalRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  fail(res, "Terjadi kesalahan pada server", null, 500);
});

// Vercel imports this file as a serverless function (see vercel.json) and
// calls the exported app directly — it never runs this file as a script, so
// app.listen() would just hang a function invocation for no reason.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
