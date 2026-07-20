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
import jurnalRoutes from "./routes/jurnal";
import penilaianRoutes from "./routes/penilaian";
import dokumenRoutes from "./routes/dokumen";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

app.use(authRoutes);
app.use("/users", userRoutes);
app.use("/divisi", divisiRoutes);
app.use("/roles", roleRoutes);
app.use("/peserta-magang", pesertaMagangRoutes);
app.use("/absensi", absensiRoutes);
app.use("/instansi", instansiRoutes);
app.use("/jurnal", jurnalRoutes);
app.use("/penilaian", penilaianRoutes);
app.use("/dokumen", dokumenRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  fail(res, "Terjadi kesalahan pada server", null, 500);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
