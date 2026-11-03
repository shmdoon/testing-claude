import { describe, expect, it } from "vitest";
import { completeProfileSchema, otpSchema, signupSchema } from "./auth";

describe("signupSchema", () => {
  const student = {
    role: "student",
    email: " Asha@Example.com ",
    full_name: " Asha ",
    class_level: "7",
    parent_email: "MOM@example.com",
  };

  it("normalises a valid student", () => {
    const r = signupSchema.parse(student);
    expect(r).toEqual({
      role: "student",
      email: "asha@example.com",
      full_name: "Asha",
      class_level: 7,
      parent_email: "mom@example.com",
    });
  });

  it("requires a parent email for students", () => {
    expect(signupSchema.safeParse({ ...student, parent_email: "" }).success).toBe(false);
  });

  it("rejects the student's own email as parent email", () => {
    const r = signupSchema.safeParse({ ...student, parent_email: "asha@example.com" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("sameAsParent");
  });

  it("only offers Class 7 and 8", () => {
    expect(signupSchema.safeParse({ ...student, class_level: "9" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...student, class_level: "8" }).success).toBe(true);
  });

  it("cannot sign up as staff", () => {
    expect(signupSchema.safeParse({ ...student, role: "admin" }).success).toBe(false);
    expect(signupSchema.safeParse({ role: "content_editor", email: "a@b.co", full_name: "A" }).success).toBe(false);
  });

  it("accepts a parent without child fields", () => {
    expect(signupSchema.parse({ role: "parent", email: "p@example.com", full_name: "Meera" })).toEqual({
      role: "parent",
      email: "p@example.com",
      full_name: "Meera",
    });
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
  it("validates both branches", () => {
    expect(completeProfileSchema.safeParse({ role: "parent", full_name: "P" }).success).toBe(true);
    expect(completeProfileSchema.safeParse({ role: "student", full_name: "S" }).success).toBe(false);
  });
});
