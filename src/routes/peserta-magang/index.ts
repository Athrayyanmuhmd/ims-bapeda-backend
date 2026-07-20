import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { listPeserta, getPesertaDetail, createPeserta, updatePeserta, deletePeserta } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listPeserta);
router.post("/", listPeserta);

router.get("/:id", getPesertaDetail);
router.post("/create", createPeserta);
router.put("/:id", updatePeserta);
router.delete("/:id", deletePeserta);

export default router;
