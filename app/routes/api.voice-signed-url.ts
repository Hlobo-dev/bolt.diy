/**
 * ElevenLabs Voice Agent — Signed URL endpoint
 * Keeps the API key server-side. Frontend calls this to get a WebSocket URL.
 * The agent is fully configured on the ElevenLabs dashboard — no overrides needed.
 */
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = ((context as any)?.cloudflare?.env as Record<string, string>) || process.env;
  const apiKey = env.ELEVENLABS_API_KEY || '';
  const agentId = new URL(request.url).searchParams.get('agent_id') || env.ELEVENLABS_AGENT_ID || '';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured. Add it to .env.local' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!agentId) {
    return new Response(
      JSON.stringify({
        error:
          'ELEVENLABS_AGENT_ID not configured. Create an agent at https://elevenlabs.io/app/conversational-ai and add its ID to .env.local',
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

    /*
     * Agent is fully configured on ElevenLabs dashboard (prompt, voice, TTS model, etc.)
     * No overrides needed — the signed URL connects directly to the pre-configured agent
     */
    return new Response(JSON.stringify({ signed_url: data.signed_url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to get signed URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
