import { Response } from "express";
import { ok, fail } from "../../lib/response";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as notificationsService from "./service";

export const getSummary = async (req: AuthRequest, res: Response) => {
  const result = await notificationsService.getSummary(pembimbingScope(req));
  if (!result.ok) {
    fail(res, result.message, null, result.status);
    return;
  }
  ok(res, result.data);
};
