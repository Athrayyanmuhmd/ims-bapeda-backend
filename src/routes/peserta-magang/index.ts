import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import { listPeserta, getPesertaDetail, createPeserta, updatePeserta, deletePeserta } from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listPeserta);
router.post("/", listPeserta);

router.get("/:id", getPesertaDetail);
router.post("/create", createPeserta);
router.put("/:id", updatePeserta);

// Admin-only: every child relation cascades, so deleting a peserta permanently
// destroys their absensi, jurnal, penilaian and dokumen too. Closing a magang
// out is a status change (SELESAI/BERHENTI), not a delete — this stays for
// genuine mistakes like a duplicate entry.
router.delete("/:id", requireRole("Admin"), deletePeserta);

export default router;
