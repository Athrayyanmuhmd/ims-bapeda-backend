import { Router } from "express";
import { rateLimit } from "../../lib/rateLimit";
import { authenticatePeserta } from "../../middleware/authPeserta";
import {
  login,
  getProfile,
  changePassword,
  listAbsensi,
  getTodayAbsensi,
  checkIn,
  checkOut,
  listJurnal,
  createJurnal,
  updateJurnal,
  listPenilaian,
  listDokumen,
} from "./controller";

const router = Router();

// Public, throttled like the staff login.
router.post("/login", rateLimit(15 * 60 * 1000, 10), login);

// Everything past here needs a peserta token. authenticatePeserta rejects staff
// tokens outright, so this router can never be reached with backoffice
// credentials.
router.use(authenticatePeserta);

router.get("/me", getProfile);
router.post("/change-password", rateLimit(15 * 60 * 1000, 10), changePassword);

router.get("/absensi", listAbsensi);
router.get("/absensi/today", getTodayAbsensi);
router.post("/absensi/check-in", checkIn);
router.post("/absensi/check-out", checkOut);

router.get("/jurnal", listJurnal);
router.post("/jurnal", createJurnal);
router.put("/jurnal/:id", updateJurnal);

// Read-only: a peserta sees their assessment and documents but never edits them.
router.get("/penilaian", listPenilaian);
router.get("/dokumen", listDokumen);

export default router;
