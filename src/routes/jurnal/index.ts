import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import { listJurnal, getJurnalDetail, createJurnal, updateJurnal, deleteJurnal } from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listJurnal);
router.post("/", listJurnal);

router.get("/:id", getJurnalDetail);
router.post("/create", createJurnal);
router.put("/:id", updateJurnal);
router.delete("/:id", deleteJurnal);

export default router;
