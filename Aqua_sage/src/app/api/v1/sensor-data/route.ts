import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';
const SENSOR_DATA_ENDPOINT = `${BACKEND_BASE_URL}/api/v1/sensor-data`;

/**
 * POST /api/v1/sensor-data
 * Proxies telemetry payload directly to the FastAPI backend with timeout guard.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(SENSOR_DATA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const isAbort = fetchError instanceof Error && fetchError.name === 'AbortError';

      return NextResponse.json(
        {
          status: 'error',
          error: isAbort ? 'BACKEND_TIMEOUT' : 'BACKEND_UNREACHABLE',
          message: isAbort
            ? `Connection to FastAPI backend timed out after 4000ms at ${SENSOR_DATA_ENDPOINT}`
            : `FastAPI backend at ${SENSOR_DATA_ENDPOINT} is currently offline / unreachable. Please ensure your Python FastAPI server is running.`,
          target_url: SENSOR_DATA_ENDPOINT,
          received_payload: payload,
        },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        error: 'INVALID_JSON_PAYLOAD',
        message: 'Failed to parse JSON body from request',
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/v1/sensor-data
 * Fetches latest live hardware reading from FastAPI backend (for Hardware Mode).
 */
export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/v1/sensor-data/latest`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'error',
          error: `HTTP_${response.status}`,
          message: `Backend returned status ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json(
      {
        status: 'error',
        error: 'BACKEND_UNREACHABLE',
        message: `FastAPI backend at ${BACKEND_BASE_URL} is currently unreachable.`,
      },
      { status: 503 }
    );
  }
}
