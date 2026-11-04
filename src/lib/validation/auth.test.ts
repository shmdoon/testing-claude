import { describe, expect, it } from "vitest";
import { completeProfileSchema, otpSchema, signupSchema } from "./auth";

describe("signupSchema (one account per child; parent on WhatsApp)", () => {
  const student = {
    email: " Asha@Example.com ",
    full_name: " Asha ",
    class_level: "7",
    parent_phone: "98765 43210",
    parent_email: "MOM@example.com",
    whatsapp_opt_in: "on",
  };

  it("normalises", () => {
    expect(signupSchema.parse(student)).toEqual({
      email: "asha@example.com",
      full_name: "Asha",
      class_level: 7,
      parent_phone: "+919876543210",
      parent_email: "mom@example.com",
      whatsapp_opt_in: "on",
    });
  });

  it("parent email is optional; WhatsApp number is required and validated", () => {
    expect(signupSchema.safeParse({ ...student, parent_email: "" }).success).toBe(true);
    expect(signupSchema.safeParse({ ...student, parent_phone: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...student, parent_phone: "12345" }).error?.issues[0]?.message).toBe("invalidPhone");
  });

  it("requires WhatsApp agreement", () => {
    expect(signupSchema.safeParse({ ...student, whatsapp_opt_in: undefined }).success).toBe(false);
  });

  it("rejects the student's own email as parent email", () => {
    const r = signupSchema.safeParse({ ...student, parent_email: "asha@example.com" });
    expect(r.error?.issues[0]?.message).toBe("sameAsParent");
  });

  it("only offers Class 7 and 8", () => {
    expect(signupSchema.safeParse({ ...student, class_level: "9" }).success).toBe(false);
  });
});

describe("otpSchema", () => {
  it("accepts 6 digits only", () => {
    expect(otpSchema.safeParse({ email: "a@b.co", token: "123456" }).success).toBe(true);
    expect(otpSchema.safeParse({ email: "a@b.co", token: "12345" }).success).toBe(false);
    expect(otpSchema.safeParse({ email: "a@b.co", token: "12345a" }).success).toBe(false);
  });
});

describe("completeProfileSchema", () => {
  it("needs the parent's WhatsApp number", () => {
    expect(completeProfileSchema.safeParse({ full_name: "S", class_level: "8", parent_phone: "9876543210", whatsapp_opt_in: "on" }).success).toBe(true);
    expect(completeProfileSchema.safeParse({ full_name: "S", class_level: "8", whatsapp_opt_in: "on" }).success).toBe(false);
  });
});
