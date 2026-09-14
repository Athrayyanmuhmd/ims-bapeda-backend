import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import { listLogbook, getLogbookDetail, createLogbook, updateLogbook, deleteLogbook } from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listLogbook);
router.post("/", listLogbook);

router.get("/:id", getLogbookDetail);
router.post("/create", createLogbook);
router.put("/:id", updateLogbook);
router.delete("/:id", deleteLogbook);

export default router;
