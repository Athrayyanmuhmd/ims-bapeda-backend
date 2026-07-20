import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { listRoles, getRoleDetail, createRole, updateRole, deleteRole } from "./controller";

const router = Router();
router.use(authenticate, requireRole("Admin"));

router.get("/", listRoles);
router.post("/", listRoles);

router.get("/:id", getRoleDetail);
router.post("/create", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
