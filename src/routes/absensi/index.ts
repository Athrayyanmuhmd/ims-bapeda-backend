import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { listAbsensi, getAbsensiDetail, createAbsensi, updateAbsensi, deleteAbsensi } from "./controller";

const router = Router();
router.use(authenticate);

router.get("/", listAbsensi);
router.post("/", listAbsensi);

router.get("/:id", getAbsensiDetail);
router.post("/create", createAbsensi);
router.put("/:id", updateAbsensi);
router.delete("/:id", deleteAbsensi);

export default router;
