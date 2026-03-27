import { EventEmitter } from "events";
import type {
  ConnectedClient,
  MCPDesignPush,
  MCPPushResult,
  PushEvent,
} from "../types/mcp-client";

/**
 * PushNotifier manages connected Chrome extension instances via Server-Sent Events (SSE).
 * When an IDE pushes changes through MCP, this service notifies all connected extensions
 * so they can apply the changes to the active page.
 *
 * Connected clients are tracked in-memory only — no database persistence is needed.
 * The service uses Node.js EventEmitter for internal pub/sub.
 */
export class PushNotifier {
  private clients: Map<string, ConnectedClient> = new Map();
  private emitter: EventEmitter = new EventEmitter();

  constructor() {
    // Allow many listeners (one per SSE connection)
    this.emitter.setMaxListeners(100);
  }

  /**
   * Register a new connected client.
   *
   * @param id - Unique client identifier
   * @param type - Client type (extension, ide, or webhook)
   * @param metadata - Optional metadata about the client
   */
  addClient(
    id: string,
    type: ConnectedClient["type"],
    metadata?: Record<string, string>
  ): void {
    const now = new Date().toISOString();
    this.clients.set(id, {
      id,
      type,
      connectedAt: now,
      lastPing: now,
      metadata,
    });
    console.log(
      `PushNotifier: Client connected — id=${id} type=${type} total=${this.clients.size}`
    );
  }

  /**
   * Unregister a client by ID.
   *
   * @param id - The client ID to remove
   */
  removeClient(id: string): void {
    const removed = this.clients.delete(id);
    if (removed) {
      console.log(
        `PushNotifier: Client disconnected — id=${id} total=${this.clients.size}`
      );
    }
  }

  /**
   * Get all currently connected clients.
   *
   * @returns Array of connected client descriptors
   */
  getClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Update the lastPing timestamp for a client.
   *
   * @param id - The client ID to update
   */
  updatePing(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      client.lastPing = new Date().toISOString();
    }
  }

  /**
   * Notify all connected clients of an incoming design push from an IDE.
   *
   * @param push - The design push payload
   * @param result - The result of processing the push
   */
  notifyPush(push: MCPDesignPush, result: MCPPushResult): void {
    const event: PushEvent = {
      type: "push",
      timestamp: new Date().toISOString(),
      data: {
        push,
        result,
      },
    };
    this.emitter.emit("event", event);
    console.log(
      `PushNotifier: Push event emitted — session=${result.sessionId} applied=${result.appliedCount} clients=${this.clients.size}`
    );
  }

  /**
   * Notify all connected clients of session changes.
   *
   * @param sessionId - The session that changed
   * @param changes - The list of changes applied
   */
  notifyChange(sessionId: string, changes: unknown[]): void {
    const event: PushEvent = {
      type: "change",
      timestamp: new Date().toISOString(),
      data: {
        sessionId,
        changes,
      },
    };
    this.emitter.emit("event", event);
    console.log(
      `PushNotifier: Change event emitted — session=${sessionId} changes=${changes.length}`
    );
  }

  /**
   * Subscribe to all push events.
   * Returns an unsubscribe function that removes the listener.
   *
   * @param handler - Callback invoked for each event
   * @returns Unsubscribe function
   */
  onEvent(handler: (event: PushEvent) => void): () => void {
    this.emitter.on("event", handler);
    return () => {
      this.emitter.off("event", handler);
    };
  }
}
