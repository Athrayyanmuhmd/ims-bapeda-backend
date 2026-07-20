import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { listDokumen, getDokumenDetail, createDokumen, deleteDokumen } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listDokumen);
router.post("/", listDokumen);

router.get("/:id", getDokumenDetail);
router.post("/create", createDokumen);
router.delete("/:id", deleteDokumen);

export default router;
