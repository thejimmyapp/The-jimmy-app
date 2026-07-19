import type { Annotation, ChatItem } from "./types";
import { useCoachStore } from "./store";

let socket: WebSocket | null = null;

export const connectRoomSocket = (roomId: string, clientId: string) => {
  socket?.close();
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws/rooms/${roomId}?client_id=${encodeURIComponent(clientId)}`);
  socket.onmessage = (message) => {
    const event = JSON.parse(message.data) as { type: string; sender_id?: string; payload?: Record<string, unknown> };
    const store = useCoachStore.getState();
    if (event.sender_id === store.clientId) return;
    if (event.type === "room.snapshot") {
      const annotations = event.payload?.annotations;
      const messages = event.payload?.messages;
      if (Array.isArray(annotations)) annotations.forEach((item) => store.addAnnotation(item as Annotation));
      if (Array.isArray(messages)) messages.forEach((item) => store.addMessage(item as ChatItem));
      return;
    }
    if (event.type === "timeline.seek" && store.followPartner) store.seek(Number(event.payload?.global_ply ?? 0));
    if (event.type === "annotation.create") store.addAnnotation(event.payload as unknown as Annotation);
    if (event.type === "annotation.delete") store.removeAnnotation(String(event.payload?.id ?? ""));
    if (event.type === "chat.message") store.addMessage(event.payload as unknown as ChatItem);
    if (event.type === "variation.create" || event.type === "variation.update") {
      const boardA = event.payload?.board_a;
      const boardB = event.payload?.board_b;
      if (boardA && boardB) store.applyExploration(boardA as never, boardB as never, String(event.payload?.notation ?? "move"));
    }
    if (event.type === "variation.return_to_game") store.returnToGame();
  };
  return socket;
};

export const sendRoomEvent = (type: string, payload: Record<string, unknown>) => {
  const { roomId, clientId } = useCoachStore.getState();
  if (!roomId || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({
      version: 1,
      event_id: crypto.randomUUID(),
      room_id: roomId,
      sender_id: clientId,
      timestamp: new Date().toISOString(),
      type,
      payload,
    }),
  );
};
