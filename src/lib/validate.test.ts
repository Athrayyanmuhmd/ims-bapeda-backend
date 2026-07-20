import { describe, expect, it } from "vitest";
import { isValidEmail } from "./validate";

describe("isValidEmail", () => {
  it.each(["admin@bapeda.go.id", "user.name+tag@sub.domain.co", "a@b.co"])(
    "accepts %s",
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    }
  );

  it.each(["notanemail", "a@b", "a @b.com", "", "a@@b.com", "@b.com"])(
    "rejects %s",
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    }
  );
});
