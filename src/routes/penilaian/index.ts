import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { listPenilaian, getPenilaianDetail, createPenilaian, updatePenilaian, deletePenilaian } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listPenilaian);
router.post("/", listPenilaian);

router.get("/:id", getPenilaianDetail);
router.post("/create", createPenilaian);
router.put("/:id", updatePenilaian);
router.delete("/:id", deletePenilaian);

export default router;
