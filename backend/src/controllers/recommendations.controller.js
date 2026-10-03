import { getTravelAgentProvider } from '../providers/index.js';

/**
 * POST /api/recommendations
 *
 * Non-streaming JSON generation. The body is already validated by validateBody(), so
 * req.validatedBody is a trusted PreferencesInput. Returns a schema-checked
 * TripRecommendation. The frontend drives loading/error/retry/regenerate purely off this
 * request's lifecycle — a retry or regenerate is just another POST.
 */
export async function createRecommendation(req, res, next) {
  try {
    const provider = getTravelAgentProvider();
    const recommendation = await provider.generateTrip(req.validatedBody);
    res.json({ recommendation });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/recommendations/stream
 *
 * Server-Sent Events variant for progressive generation. Emits a `stage` event as each
 * pipeline stage starts/finishes, then a final `result` event with the full
 * recommendation, then `done`. Errors are delivered as an `error` event so the client can
 * show an error state and offer retry without parsing a broken stream.
 *
 * SSE is used instead of chunked JSON because the agent is multi-stage and discrete:
 * stage boundaries are the natural progress unit, and SSE needs no extra client library.
 */
export async function streamRecommendation(req, res) {
  // SSE headers. Flush them immediately so the client's EventSource connects.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // If the client disconnects mid-generation, stop writing.
  let clientGone = false;
  req.on('close', () => {
    clientGone = true;
  });

  try {
    const provider = getTravelAgentProvider();
    const recommendation = await provider.generateTripStream(req.validatedBody, (event) => {
      if (!clientGone) send('stage', event);
    });

    if (!clientGone) {
      send('result', { recommendation });
      send('done', { ok: true });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (!clientGone) {
      send('error', {
        error: err.publicMessage || 'Something went wrong generating your trip.',
        details: Array.isArray(err.details) ? err.details : undefined,
      });
    }
  } finally {
    res.end();
  }
}
