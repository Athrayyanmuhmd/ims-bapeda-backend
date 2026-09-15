import { Router } from "express";
import { rateLimit } from "../../lib/rateLimit";
import { authenticatePeserta } from "../../middleware/authPeserta";
import {
  login,
  getProfile,
  updateOwnProfile,
  changePassword,
  listAbsensi,
  getTodayAbsensi,
  checkIn,
  checkOut,
  getCheckInWindow,
  reportIzin,
  listLogbook,
  createLogbook,
  updateLogbook,
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
router.put("/me", rateLimit(15 * 60 * 1000, 20), updateOwnProfile);
router.post("/change-password", rateLimit(15 * 60 * 1000, 10), changePassword);

router.get("/absensi", listAbsensi);
router.get("/absensi/today", getTodayAbsensi);
router.get("/absensi/check-in-window", getCheckInWindow);
router.post("/absensi/check-in", checkIn);
router.post("/absensi/check-out", checkOut);
router.post("/absensi/izin", rateLimit(15 * 60 * 1000, 20), reportIzin);

router.get("/logbook", listLogbook);
router.post("/logbook", createLogbook);
router.put("/logbook/:id", updateLogbook);

// Read-only: a peserta sees their assessment and documents but never edits them.
router.get("/penilaian", listPenilaian);
router.get("/dokumen", listDokumen);

export default router;
