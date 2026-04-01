import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    friendship: {
      findUnique: vi.fn(),
    },
    friendRequest: {
      findUnique: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const getCurrentSession = vi.fn();

  return { prisma, getCurrentSession };
});

vi.mock("@/lib/auth", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { POST } from "@/app/api/friends/add/route";

describe("friends add route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not create a duplicate unread notification for the same friend request", async () => {
    const tx = {
      friendRequest: {
        create: vi.fn().mockResolvedValue({ id: "request-1" }),
        update: vi.fn(),
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue({ id: "notification-1" }),
        create: vi.fn(),
      },
    };

    mocks.getCurrentSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "friend-1" });
    mocks.prisma.friendship.findUnique.mockResolvedValue(null);
    mocks.prisma.friendRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    );

    const response = await POST(
      new Request("http://localhost/api/friends/add", {
        method: "POST",
        body: JSON.stringify({
          friendId: "friend-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(tx.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "friend-1",
        actorId: "user-1",
        type: "friend_request",
        friendRequestId: "request-1",
        readAt: null,
      },
      select: {
        id: true,
      },
    });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
