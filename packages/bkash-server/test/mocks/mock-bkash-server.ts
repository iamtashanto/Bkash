import http from 'node:http';

export interface MockBkashServerOptions {
  port?: number;
}

export class MockBkashServer {
  public server: http.Server | null = null;
  public port: number = 0;
  public baseUrl: string = '';

  // Call counters for assertion
  public grantCallCount = 0;
  public refreshCallCount = 0;
  public createCallCount = 0;
  public executeCallCount = 0;
  public queryCallCount = 0;

  // Behaviors
  public simulateRateLimit = false;
  public simulate2062OnExecute = false;
  public simulateTimeoutOnExecuteMs = 0;
  public simulateAmountMismatch: string | null = null;
  public simulateInvoiceMismatch: string | null = null;
  public simulateCurrencyMismatch: string | null = null;

  public async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          const url = req.url || '';

          if (this.simulateRateLimit) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ statusCode: '429', statusMessage: 'Rate limit exceeded' }));
            return;
          }

          // Grant token
          if (url.includes('/token/grant') || url.includes('/auth/grant-token')) {
            this.grantCallCount++;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: '0000',
                statusMessage: 'Successful',
                id_token: `mock_id_token_${this.grantCallCount}`,
                refresh_token: 'mock_refresh_token_123',
                token_type: 'Bearer',
                expires_in: '3600',
              })
            );
            return;
          }

          // Refresh token
          if (url.includes('/auth/refresh-token')) {
            this.refreshCallCount++;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: '0000',
                statusMessage: 'Successful',
                id_token: `mock_refreshed_id_token_${this.refreshCallCount}`,
                refresh_token: 'mock_refresh_token_123',
                token_type: 'Bearer',
                expires_in: '3600',
              })
            );
            return;
          }

          // Create payment
          if (url.includes('/checkout/create') || url.includes('/payment/create')) {
            this.createCallCount++;
            const parsed = body ? JSON.parse(body) : {};
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: '0000',
                statusMessage: 'Successful',
                paymentID: 'BKASH_PAY_MOCK_12345',
                bkashURL: 'https://sandbox.payment.bkash.com/redirect/12345',
                callbackURL: parsed.callbackURL || 'https://merchant.example.com/callback',
                amount: parsed.amount || '1550.00',
                currency: 'BDT',
                intent: 'sale',
                merchantInvoiceNumber: parsed.merchantInvoiceNumber || 'INV_1001',
                paymentCreateTime: new Date().toISOString(),
              })
            );
            return;
          }

          // Execute payment
          if (url.includes('/checkout/execute') || url.includes('/payment/execute')) {
            this.executeCallCount++;

            if (this.simulateTimeoutOnExecuteMs > 0) {
              await new Promise((r) => setTimeout(r, this.simulateTimeoutOnExecuteMs));
            }

            if (this.simulate2062OnExecute) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  statusCode: '2062',
                  externalCode: '2062',
                  statusMessage: 'The payment has already been completed',
                  errorMessageEn: 'The payment has already been completed',
                })
              );
              return;
            }

            const parsed = body ? JSON.parse(body) : {};
            const paymentId = parsed.paymentID || parsed.paymentId || 'BKASH_PAY_MOCK_12345';

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: '0000',
                statusMessage: 'Successful',
                paymentID: paymentId,
                trxID: 'TRX_9999888877',
                transactionStatus: 'Completed',
                amount: this.simulateAmountMismatch || '1550.00',
                currency: this.simulateCurrencyMismatch || 'BDT',
                merchantInvoiceNumber: this.simulateInvoiceMismatch || 'INV_1001',
                customerMsisdn: '01712345678',
                paymentExecuteTime: new Date().toISOString(),
              })
            );
            return;
          }

          // Query payment status
          if (url.includes('/payment/status') || url.includes('/payment/query')) {
            this.queryCallCount++;
            const parsed = body ? JSON.parse(body) : {};
            const paymentId = parsed.paymentID || parsed.paymentId || 'BKASH_PAY_MOCK_12345';

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: '0000',
                statusMessage: 'Successful',
                paymentID: paymentId,
                trxID: 'TRX_RECONCILED_8888',
                transactionStatus: 'Completed',
                amount: this.simulateAmountMismatch || '1550.00',
                currency: this.simulateCurrencyMismatch || 'BDT',
                merchantInvoiceNumber: this.simulateInvoiceMismatch || 'INV_1001',
                customerMsisdn: '01712345678',
                paymentExecuteTime: new Date().toISOString(),
              })
            );
            return;
          }

          // Default fallback
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ statusCode: '404', statusMessage: 'Not found' }));
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve(this.baseUrl);
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  public reset(): void {
    this.grantCallCount = 0;
    this.refreshCallCount = 0;
    this.createCallCount = 0;
    this.executeCallCount = 0;
    this.queryCallCount = 0;
    this.simulateRateLimit = false;
    this.simulate2062OnExecute = false;
    this.simulateTimeoutOnExecuteMs = 0;
    this.simulateAmountMismatch = null;
    this.simulateInvoiceMismatch = null;
    this.simulateCurrencyMismatch = null;
  }
}
