import { Response } from 'express';

interface Client {
  id: string;
  userId: string;
  res: Response;
}

class RealtimeService {
  private clients: Map<string, Client> = new Map();

  constructor() {
    // Send a keep-alive ping every 25 seconds
    setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  public addClient(id: string, userId: string, res: Response) {
    this.clients.set(id, { id, userId, res });

    // Send initial connection event
    this.sendToClient(res, 'connected', {
      message: 'Real-time SSE connection established',
      timestamp: new Date().toISOString(),
      clientId: id,
    });
  }

  public removeClient(id: string) {
    this.clients.delete(id);
  }

  public broadcast(eventType: string, data: any) {
    const payload = JSON.stringify({ eventType, data, timestamp: new Date().toISOString() });
    for (const client of this.clients.values()) {
      try {
        client.res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
      } catch (err) {
        this.clients.delete(client.id);
      }
    }
  }

  public broadcastToUser(userId: string, eventType: string, data: any) {
    const payload = JSON.stringify({ eventType, data, timestamp: new Date().toISOString() });
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        try {
          client.res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
        } catch (err) {
          this.clients.delete(client.id);
        }
      }
    }
  }

  public emitAgentStep(userId: string, requestId: string, step: string, label: string, details?: any) {
    this.broadcastToUser(userId, 'agent_step', {
      requestId,
      step,
      label,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  private sendToClient(res: Response, event: string, data: any) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private sendHeartbeat() {
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch (err) {
        this.clients.delete(id);
      }
    }
  }
}

export const realtimeService = new RealtimeService();
