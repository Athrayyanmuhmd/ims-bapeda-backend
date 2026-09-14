import { Router } from "express";
import { rateLimit } from "../../lib/rateLimit";
import { login, verifyToken } from "./controller";

const router = Router();

const loginRateLimit = rateLimit(15 * 60 * 1000, 10); // 10 attempts / 15 min per IP
const verifyRateLimit = rateLimit(15 * 60 * 1000, 60);

router.post("/login", loginRateLimit, login);
router.post("/verify-token", verifyRateLimit, verifyToken);

export default router;
