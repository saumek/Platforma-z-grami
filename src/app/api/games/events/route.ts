import { getCurrentSession } from "@/lib/auth";
import { subscribeToGameEvents } from "@/lib/game-events";
import { prisma } from "@/lib/prisma";

function encodeSseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentRoomCode: true },
  });

  if (!user?.currentRoomCode) {
    return new Response("Not in room", { status: 409 });
  }

  const roomCode = user.currentRoomCode;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      const send = (event: string, data: unknown) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(encoder.encode(encodeSseChunk(event, data)));
      };

      send("ready", { roomCode, at: Date.now() });

      const unsubscribe = subscribeToGameEvents(roomCode, (payload) => {
        send(payload.type === "reaction" ? "reaction" : "state", payload);
      });

      const heartbeatId = setInterval(() => {
        send("heartbeat", { at: Date.now() });
      }, 20_000);

      const close = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(heartbeatId);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      // no-op; cleanup is handled by the runtime closing the stream
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
