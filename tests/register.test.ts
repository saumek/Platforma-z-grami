import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      create: vi.fn(),
    },
  };

  const hashPassword = vi.fn();

  return { prisma, hashPassword };
});

vi.mock("@/lib/auth", () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { POST } from "@/app/api/auth/register/route";

describe("register route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when the email already exists", async () => {
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["email"] },
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "Password123!",
          confirmPassword: "Password123!",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message: "Użytkownik z takim adresem e-mail już istnieje.",
    });
  });
});
