import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { listInstansi, getInstansiDetail, createInstansi, updateInstansi, deleteInstansi } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listInstansi);
router.post("/", listInstansi);

router.get("/:id", getInstansiDetail);

router.post("/create", requireRole("Admin"), createInstansi);
router.put("/:id", requireRole("Admin"), updateInstansi);
router.delete("/:id", requireRole("Admin"), deleteInstansi);

export default router;
