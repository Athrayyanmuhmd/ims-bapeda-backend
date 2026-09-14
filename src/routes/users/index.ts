import { Router } from "express";
import { rateLimit } from "../../lib/rateLimit";
import { authenticate, requireRole } from "../../middleware/auth";
import {
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  changeOwnPassword,
} from "./controller";

const router = Router();
router.use(authenticate);

// Read access is open to any authenticated user (e.g. picking a pembimbing
// lapangan when creating a peserta magang). Only mutations are Admin-only.
router.get("/", listUsers);
router.post("/", listUsers);

// Declared before "/:id" so the literal path can't be swallowed by the param
// route. Any role may change their *own* password — throttled because it takes
// the current password and would otherwise be an online guessing target.
router.post("/change-password", rateLimit(15 * 60 * 1000, 10), changeOwnPassword);

router.get("/:id", getUserDetail);
router.post("/detail/:id", getUserDetail); // Legacy

router.post("/create", requireRole("Admin"), createUser);
router.put("/:id", requireRole("Admin"), updateUser);
router.delete("/:id", requireRole("Admin"), deleteUser);

export default router;
