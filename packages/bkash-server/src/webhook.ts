/**
 * EXPERIMENTAL Webhook Module for AWS SNS signature verification.
 *
 * NOTE: bKash delivers asynchronous IPN callbacks using AWS SNS notifications.
 * This module requires Node.js cryptographic primitives (node:crypto) and is
 * published as a dedicated subpath (`bkash-server/webhook`) to keep the root
 * package entry purely edge-safe and runtime-agnostic.
 *
 * Status: EXPERIMENTAL until verified in production against live bKash AWS SNS messages.
 */

export * from './webhook/webhook-verifier.js';

export const IS_WEBHOOK_EXPERIMENTAL = true;
