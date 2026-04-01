import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const prisma = {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };

  const removeUserFromRoom = vi.fn();
  const redirect = vi.fn();

  return { cookieStore, prisma, removeUserFromRoom, redirect };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/room-cleanup", () => ({
  removeUserFromRoom: mocks.removeUserFromRoom,
}));

import { getCurrentSession } from "@/lib/auth";

describe("getCurrentSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not refresh when plenty of time is left", async () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    mocks.cookieStore.get.mockReturnValue({ value: "session-1" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session-1",
      expiresAt,
      user: {
        id: "user-1",
        email: "user1@example.com",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });

    const session = await getCurrentSession();

    expect(session?.id).toBe("session-1");
    expect(session?.expiresAt).toEqual(expiresAt);
    expect(mocks.prisma.session.update).not.toHaveBeenCalled();
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it("refreshes only inside the refresh window", async () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    mocks.cookieStore.get.mockReturnValue({ value: "session-2" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session-2",
      expiresAt,
      user: {
        id: "user-2",
        email: "user2@example.com",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });

    const session = await getCurrentSession();

    expect(session?.id).toBe("session-2");
    expect(mocks.prisma.session.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.session.update).toHaveBeenCalledWith({
      where: { id: "session-2" },
      data: {
        expiresAt: expect.any(Date),
      },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledTimes(1);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      "gamely_session",
      "session-2",
      expect.objectContaining({
        expires: expect.any(Date),
        path: "/",
      }),
    );
  });

  it("cleans up an expired session and removes the user from the room", async () => {
    mocks.cookieStore.get.mockReturnValue({ value: "session-3" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session-3",
      expiresAt: new Date(Date.now() - 60_000),
      user: {
        id: "user-3",
        email: "user3@example.com",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });

    const session = await getCurrentSession();

    expect(session).toBeNull();
    expect(mocks.removeUserFromRoom).toHaveBeenCalledWith("user-3");
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: "session-3" },
    });
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      "gamely_session",
      "",
      expect.objectContaining({
        path: "/",
      }),
    );
  });
});
