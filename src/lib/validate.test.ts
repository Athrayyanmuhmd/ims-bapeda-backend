import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPhoneId } from "./validate";

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

describe("isValidPhoneId", () => {
  it.each(["081234567890", "0812-3456-7890", "+6281234567890", "6281234567890"])(
    "accepts %s",
    (phone) => {
      expect(isValidPhoneId(phone)).toBe(true);
    }
  );

  it.each(["021123456", "0812", "12345", "+12025550123", ""])("rejects %s", (phone) => {
    expect(isValidPhoneId(phone)).toBe(false);
  });
});
