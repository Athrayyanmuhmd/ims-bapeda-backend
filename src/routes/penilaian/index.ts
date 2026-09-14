import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import {
  listPenilaian,
  getPenilaianDetail,
  createPenilaian,
  updatePenilaian,
  deletePenilaian,
} from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listPenilaian);
router.post("/", listPenilaian);

router.get("/:id", getPenilaianDetail);
router.post("/create", createPenilaian);
router.put("/:id", updatePenilaian);
router.delete("/:id", deletePenilaian);

export default router;
