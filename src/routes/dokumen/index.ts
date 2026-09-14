import { Router } from "express";
import { authenticate, requireRole, STAFF_OPS_ROLES } from "../../middleware/auth";
import {
  listDokumen,
  getDokumenDetail,
  createDokumen,
  deleteDokumen,
  authorizeFile,
} from "./controller";

const router = Router();
router.use(authenticate);
router.use(requireRole(...STAFF_OPS_ROLES));

router.get("/", listDokumen);
router.post("/", listDokumen);

// Before /:id so "authorize-file" is not captured as an id.
router.post("/authorize-file", authorizeFile);

router.get("/:id", getDokumenDetail);
router.post("/create", createDokumen);
router.delete("/:id", deleteDokumen);

export default router;
