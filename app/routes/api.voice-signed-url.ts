/**
 * ElevenLabs Voice Agent — Signed URL endpoint
 * Keeps the API key server-side. Frontend calls this to get a WebSocket URL.
 * Accepts optional voice_id query param to override the agent's default voice.
 */
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = ((context as any)?.cloudflare?.env as Record<string, string>) || process.env;
  const apiKey = env.ELEVENLABS_API_KEY || '';
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agent_id') || env.ELEVENLABS_AGENT_ID || '';
  const voiceIdOverride = url.searchParams.get('voice_id') || '';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured. Add it to .env.local' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!agentId) {
    return new Response(
      JSON.stringify({
        error: 'ELEVENLABS_AGENT_ID not configured.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': apiKey },
      },
    );

    if (!resp.ok) {
      const body = await resp.text();
      return new Response(JSON.stringify({ error: `ElevenLabs API error (${resp.status}): ${body}` }), {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = (await resp.json()) as { signed_url: string };

    // If a voice override was requested, pass it as overrides
    const result: any = { signed_url: data.signed_url };

    if (voiceIdOverride) {
      result.overrides = {
        tts: { voiceId: voiceIdOverride },
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to get signed URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
