import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import {
  listAbsensi,
  listPendingIzin,
  getAbsensiDetail,
  createAbsensi,
  updateAbsensi,
  approveIzin,
  rejectIzin,
  deleteAbsensi,
} from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listAbsensi);
router.post("/", listAbsensi);

// Static paths before /:id so "izin" isn't treated as an absensi id.
router.get("/izin/pending", listPendingIzin);
router.post("/:id/approve-izin", approveIzin);
router.post("/:id/reject-izin", rejectIzin);

router.get("/:id", getAbsensiDetail);
router.post("/create", createAbsensi);
router.put("/:id", updateAbsensi);
router.delete("/:id", deleteAbsensi);

export default router;
