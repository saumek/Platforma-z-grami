import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { publishGameEvent } from "@/lib/game-events";
import { prisma } from "@/lib/prisma";
import type { AuthResponse } from "@/types/auth";

type GameCommandResult = {
  success: boolean;
  message: string;
};

type GameCommandContext<TBody> = {
  body: TBody;
  roomCode: string;
  userId: string;
};

type RunGameCommandOptions<TBody, TState> = {
  request?: Request;
  parseBody?: (request: Request) => Promise<TBody>;
  command: (context: GameCommandContext<TBody>) => Promise<GameCommandResult>;
  getState?: (context: GameCommandContext<TBody>) => Promise<TState | null>;
  notInRoomMessage?: string;
  errorMessage: string;
};

export async function runGameCommandRoute<TBody = undefined, TState = undefined>({
  request,
  parseBody,
  command,
  getState,
  notInRoomMessage = "Najpierw dołącz do pokoju.",
  errorMessage,
}: RunGameCommandOptions<TBody, TState>) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: "Najpierw zaloguj się do swojego konta." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentRoomCode: true },
    });

    if (!user?.currentRoomCode) {
      return NextResponse.json<AuthResponse>(
        { success: false, message: notInRoomMessage },
        { status: 409 },
      );
    }

    const body = request && parseBody ? await parseBody(request) : (undefined as TBody);
    const context = {
      body,
      roomCode: user.currentRoomCode,
      userId: session.user.id,
    } satisfies GameCommandContext<TBody>;

    const result = await command(context);

    if (!result.success) {
      return NextResponse.json<AuthResponse>(result, { status: 400 });
    }

    publishGameEvent(user.currentRoomCode);

    const state = getState ? await getState(context) : undefined;

    return NextResponse.json({
      success: true,
      message: result.message,
      state,
    });
  } catch {
    return NextResponse.json<AuthResponse>(
      { success: false, message: errorMessage },
      { status: 500 },
    );
  }
}
