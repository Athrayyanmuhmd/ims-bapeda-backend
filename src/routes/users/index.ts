import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth";
import { listUsers, getUserDetail, createUser, updateUser, deleteUser } from "./controller";

const router = Router();
router.use(authenticate);

// Read access is open to any authenticated user (e.g. picking a pembimbing
// lapangan when creating a peserta magang). Only mutations are Admin-only.
router.get("/", listUsers);
router.post("/", listUsers);

router.get("/:id", getUserDetail);
router.post("/detail/:id", getUserDetail); // Legacy

router.post("/create", requireRole("Admin"), createUser);
router.put("/:id", requireRole("Admin"), updateUser);
router.delete("/:id", requireRole("Admin"), deleteUser);

export default router;
