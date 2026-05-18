// ============================================================
// GET  /api/subscriptions  — List from MySQL
// POST /api/subscriptions  — Subscribe via PDM API + save to DB
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query, execute } from '@/db/connection';
import { API_TOKENS, BASE_URLS } from '@/lib/api/client';
import type { StoredSubscription, SubscribeRequest, SubscribeResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

// -------------------- GET --------------------
export async function GET(_request: NextRequest) {
  try {
    const rows = await query<StoredSubscription>(
      `SELECT * FROM hg_subscriptions ORDER BY createdAt DESC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
      message: `Found ${rows.length} subscriptions`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[GET /api/subscriptions]', message);
    return NextResponse.json(
      { success: false, data: [], error: message },
      { status: 500 }
    );
  }
}

// -------------------- POST --------------------
export async function POST(request: NextRequest) {
  let body: Partial<SubscribeRequest & { callbackUrl?: string }>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const callbackUrl =
    body.callbackUrl ||
    body.envelopeSubUrls?.Callback ||
    BASE_URLS.EGLOBE_CALLBACK;

  const subscribePayload: SubscribeRequest = {
    method: body.method || 'ARI',
    propertyIds: body.propertyIds || [],
    ratePlans: body.ratePlans || [],
    userId: body.userId || 'eglobe',
    envelope: body.envelope || 'Hyperguest',
    authentication: {
      bearer: API_TOKENS.CALLBACK_TOKEN,
    },
    envelopeSubUrls: {
      Callback: callbackUrl,
    },
    email: body.email || '',
    parameters: body.parameters || {},
    version: body.version ?? 1,
  };

  try {
    // ---- Call PDM Subscribe ----
    const response = await axios.post<SubscribeResponse>(
      `${BASE_URLS.PDM}/api/pdm/subscriptions/subscribe`,
      subscribePayload,
      {
        headers: {
          Authorization: `Bearer ${API_TOKENS.OPERATIONS_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    const result = response.data;

    // ---- Persist to MySQL (best-effort) ----
    const ratePlanCodesJson = JSON.stringify(
      Object.fromEntries(
        subscribePayload.ratePlans.map((rp) => [String(rp.propertyId), rp.ratePlanCodes])
      )
    );
    try {
      await execute(
        `
        INSERT INTO hg_subscriptions
          (subscriptionId, userId, propertyIds, ratePlanCodes, method, envelope,
           status, version, email, callbackUrl, rawResponse, createdAt, updatedAt)
        VALUES
          (:subscriptionId, :userId, :propertyIds, :ratePlanCodes, :method, :envelope,
           :status, :version, :email, :callbackUrl, :rawResponse, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE
          status = VALUES(status), updatedAt = UTC_TIMESTAMP()
        `,
        {
          subscriptionId: result.subscriptionId || '',
          userId:         subscribePayload.userId,
          propertyIds:    JSON.stringify(subscribePayload.propertyIds),
          ratePlanCodes:  ratePlanCodesJson,
          method:         subscribePayload.method,
          envelope:       subscribePayload.envelope,
          status:         result.status || 'enabled',
          version:        subscribePayload.version,
          email:          subscribePayload.email,
          callbackUrl:    callbackUrl,
          rawResponse:    JSON.stringify(result),
        }
      );
    } catch {
      // DB write failure is non-fatal
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Subscription created',
    });
  } catch (err: unknown) {
    // Extract the PDM response body for a clear error message
    let message: string;
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      const bodyStr = body
        ? typeof body === 'string' ? body : JSON.stringify(body)
        : err.message;
      message = `PDM API error ${err.response?.status ?? ''}: ${bodyStr}`.trim();
    } else {
      message = err instanceof Error ? err.message : 'Unknown error';
    }

    console.error('[POST /api/subscriptions]', message);

    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 502 }
    );
  }
}
