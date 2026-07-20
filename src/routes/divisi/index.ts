import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { listDivisi, getDivisiDetail, createDivisi, updateDivisi, deleteDivisi } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listDivisi);
router.post("/", listDivisi);

router.get("/:id", getDivisiDetail);

router.post("/create", requireRole("Admin"), createDivisi);
router.put("/:id", requireRole("Admin"), updateDivisi);
router.delete("/:id", requireRole("Admin"), deleteDivisi);

export default router;
