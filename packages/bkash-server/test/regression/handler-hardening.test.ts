import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BkashServer } from "../../src/server.js";
import { BkashHttpHandler } from "../../src/http/handler.js";
import { BkashTimeoutError } from "../../src/errors.js";
import { MockBkashServer } from "../mocks/mock-bkash-server.js";

const order = async () => ({
  amount: 1550,
  currency: "BDT" as const,
  invoiceNumber: "INV_1001",
});

const post = (path: string, body: unknown) =>
  new Request(`https://shop.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("HTTP handler hardening (regression)", () => {
  let mockServer: MockBkashServer;
  let bkash: BkashServer;

  beforeAll(async () => {
    mockServer = new MockBkashServer();
    const baseUrl = await mockServer.start();
    bkash = new BkashServer({
      apiVersion: "v1.2.0-beta",
      appKey: "k",
      appSecret: "s",
      username: "u",
      password: "p",
      baseUrl,
    });
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it("rejects a client callbackUrl outside the allowlist", async () => {
    const handler = new BkashHttpHandler(bkash, {
      resolveOrder: order,
      allowedCallbackOrigins: ["https://shop.example"],
    });
    const bad = await handler.handle(
      post("/create", { callbackUrl: "https://evil.test/x" }),
    );
    expect(bad.status).toBe(400);
    const good = await handler.handle(
      post("/create", { callbackUrl: "https://shop.example/cb" }),
    );
    expect(good.status).toBe(200);
  });

  it("never forwards a client callbackUrl when no allowlist is configured", async () => {
    const seen: string[] = [];
    const spy = {
      createPayment: async (p: { callbackUrl: string }) => {
        seen.push(p.callbackUrl);
        return { paymentId: "P1" };
      },
    } as unknown as BkashServer;
    const handler = new BkashHttpHandler(spy, { resolveOrder: order });
    const res = await handler.handle(
      post("/create", { callbackUrl: "https://evil.test/x" }),
    );
    expect(res.status).toBe(200);
    expect(seen[0]).toBe("https://shop.example/callback");
  });

  it("does not take orderId or payerReference from the client body", async () => {
    let params: Record<string, unknown> = {};
    const spy = {
      createPayment: async (p: Record<string, unknown>) => {
        params = p;
        return { paymentId: "P1" };
      },
    } as unknown as BkashServer;
    const handler = new BkashHttpHandler(spy, { resolveOrder: order });
    await handler.handle(
      post("/create", { orderId: "X", payerReference: "01700000000" }),
    );
    expect(params.orderId).toBeUndefined();
    expect(params.payerReference).toBeUndefined();
  });

  it('reports an unconfirmed execution as status "unknown", not failed', async () => {
    const stub = {
      executePayment: async () => {
        throw new BkashTimeoutError("PAY1", 30000);
      },
    } as unknown as BkashServer;
    const handler = new BkashHttpHandler(stub, { resolveOrder: order });
    const res = await handler.handle(
      new Request(
        "https://shop.example/callback?paymentID=PAY1&status=success",
      ),
    );
    const body = (await res.json()) as { success: boolean; status?: string };
    expect(res.status).toBe(202);
    expect(body.status).toBe("unknown");
  });

  it("does not leak raw internal error messages", async () => {
    const stub = {
      executePayment: async () => {
        throw new Error("redis://:hunter2@10.0.0.5 refused");
      },
    } as unknown as BkashServer;
    const handler = new BkashHttpHandler(stub, { resolveOrder: order });
    const res = await handler.handle(
      new Request(
        "https://shop.example/callback?paymentID=PAY1&status=success",
      ),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("hunter2");
  });

  it("rejects (does not acknowledge) a webhook that fails verification", async () => {
    const stub = {
      webhook: { verify: async () => null },
    } as unknown as BkashServer;
    const handler = new BkashHttpHandler(stub, { resolveOrder: order });
    const res = await handler.handle(
      post("/webhook", { Type: "Notification" }),
    );
    expect(res.status).toBe(401);
  });
});
