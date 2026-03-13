/**
 * useElevenLabsVoice — React hook for ElevenLabs Conversational AI
 *
 * TWO PHASES:
 *   Phase 1 (Planning): Natural conversation to understand what to build
 *   Phase 2 (Coding):   Voice stays alive — agent narrates, user can interrupt
 *
 * The voice agent NEVER dies during coding. It stays connected and can:
 * - Narrate what bolt is building (receives streaming updates)
 * - Answer questions about the code mid-build
 * - Accept voice interruptions: "wait, make it dark mode"
 * - Re-trigger bolt with updated instructions
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from '@11labs/client';

export interface VoiceMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'coding' // Phase 2: voice alive + bolt coding
  | 'error'
  | 'disconnected';

export type VoicePhase = 'planning' | 'coding';

interface UseElevenLabsVoiceOptions {
  /** Fires when voice agent determines we're ready to code. Prompt = compiled conversation. */
  onReadyToBuild?: (compiledPrompt: string) => void;

  /** Fires when user gives a voice interruption during coding phase. */
  onVoiceInterrupt?: (instruction: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onError?: (error: string) => void;
}

// Agent trigger phrases — when agent says these, start coding
const BUILD_TRIGGER_PHRASES = [
  'let me start coding',
  'start coding this',
  'start building this',
  "i'll start building",
  "i'll start coding",
  'let me build this',
  'i have a clear picture',
  "got it, i'll code",
  "i'll get this built",
  'beginning to code',
  'let me start building',
];

// User trigger phrases — when user says these, compile and send
const USER_BUILD_TRIGGERS = [
  'build it',
  'go ahead',
  'start coding',
  "let's do it",
  "let's build it",
  'code it',
  'make it',
  'start building',
  'go for it',
  'do it',
  'yes build',
  'yeah build',
  'ok build',
  'okay build',
  'yes please',
  'sounds good',
  'perfect',
  'that sounds right',
  "that's right",
  'exactly',
  'yes that',
  'yep',
];

// Interruption phrases during coding — user wants to change something
const INTERRUPT_PHRASES = [
  'wait',
  'stop',
  'hold on',
  'actually',
  'change',
  'instead',
  'no no',
  'make it',
  'can you',
  'add a',
  'remove the',
  'switch to',
  'use dark',
  'use light',
  'different',
];

export function useElevenLabsVoice(options: UseElevenLabsVoiceOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [phase, setPhase] = useState<VoicePhase>('planning');
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<VoiceMessage[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState('');
  const [isCoding, setIsCoding] = useState(false);

  const conversationRef = useRef<any>(null);
  const historyRef = useRef<VoiceMessage[]>([]);
  const buildTriggeredRef = useRef(false);
  const phaseRef = useRef<VoicePhase>('planning');

  // Keep refs in sync
  useEffect(() => {
    historyRef.current = conversationHistory;
  }, [conversationHistory]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const updateStatus = useCallback(
    (newStatus: VoiceStatus) => {
      setStatus(newStatus);
      options.onStatusChange?.(newStatus);
    },
    [options.onStatusChange],
  );

  /**
   * Compile conversation history into a detailed coding prompt
   */
  const compilePrompt = useCallback(() => {
    const history = historyRef.current;

    if (history.length === 0) {
      return '';
    }

    const conversationText = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n');

    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
    const summary = lastAssistant?.text || '';

    return `The user had a voice conversation with a coding assistant to plan this project. Here is the full conversation:

---
${conversationText}
---

Based on this conversation, the assistant's final understanding is:
${summary}

Please implement this application now. Build it completely with all the features discussed. Use best practices, clean code, and a polished UI. Make it production-quality.`;
  }, []);

  /**
   * Check if a message contains a build trigger (Phase 1 only)
   */
  const checkForBuildTrigger = useCallback(
    (text: string, role: 'user' | 'assistant') => {
      // Only trigger in planning phase
      if (phaseRef.current !== 'planning' || buildTriggeredRef.current) {
        return;
      }

      const lower = text.toLowerCase();
      const triggers = role === 'user' ? USER_BUILD_TRIGGERS : BUILD_TRIGGER_PHRASES;
      const triggered = triggers.some((phrase) => lower.includes(phrase));

      if (triggered) {
        buildTriggeredRef.current = true;

        // Transition to coding phase — DO NOT kill voice session
        setPhase('coding');
        setIsCoding(true);
        updateStatus('coding');

        // Small delay to let the last message settle, then fire build
        setTimeout(() => {
          const prompt = compilePrompt();

          if (prompt && options.onReadyToBuild) {
            options.onReadyToBuild(prompt);
          }
        }, 1500);
      }
    },
    [compilePrompt, options.onReadyToBuild, updateStatus],
  );

  /**
   * Check for voice interruptions during coding phase
   */
  const checkForInterruption = useCallback(
    (text: string) => {
      if (phaseRef.current !== 'coding') {
        return;
      }

      const lower = text.toLowerCase();
      const isInterrupt = INTERRUPT_PHRASES.some((phrase) => lower.includes(phrase));

      if (isInterrupt && options.onVoiceInterrupt) {
        options.onVoiceInterrupt(text);
      }
    },
    [options.onVoiceInterrupt],
  );

  /**
   * Feed bolt's streaming output to the voice agent for narration.
   * Call this from the parent component as bolt streams its response.
   */
  const feedCodingUpdate = useCallback((updateText: string) => {
    if (!conversationRef.current || phaseRef.current !== 'coding') {
      return;
    }

    // Add as a system-level message in conversation history for context
    const msg: VoiceMessage = {
      role: 'assistant',
      text: `[Coding update] ${updateText}`,
      timestamp: Date.now(),
    };
    setConversationHistory((prev) => [...prev, msg]);
  }, []);

  /**
   * Notify voice agent that coding is complete
   */
  const notifyCodingComplete = useCallback(() => {
    setIsCoding(false);

    if (phaseRef.current === 'coding') {
      updateStatus('listening');
    }
  }, [updateStatus]);

  /**
   * Start a voice session with ElevenLabs
   */
  const startSession = useCallback(
    async (_voiceName?: string) => {
      if (conversationRef.current) {
        await endSession();
      }

      buildTriggeredRef.current = false;
      setPhase('planning');
      setIsCoding(false);
      setConversationHistory([]);
      setCurrentUserTranscript('');
      updateStatus('connecting');

      try {
        // 1. Get signed URL from our backend (pass voice ID if provided)
        const voiceParam = _voiceName ? `?voice_id=${encodeURIComponent(_voiceName)}` : '';
        const resp = await fetch(`/api/voice-signed-url${voiceParam}`);
        const data = (await resp.json()) as { signed_url?: string; overrides?: any; error?: string };

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.signed_url) {
          throw new Error('No signed URL returned');
        }

        // 2. Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // 3. Start ElevenLabs conversation (with optional voice override)
        const conversation = await Conversation.startSession({
          signedUrl: data.signed_url,
          overrides: data.overrides || undefined,

          onConnect: () => {
            console.log('[Voice] Connected to ElevenLabs');
            setIsConnected(true);
            updateStatus('listening');
          },

          onDisconnect: () => {
            console.log('[Voice] Disconnected');
            setIsConnected(false);
            setIsAgentSpeaking(false);
            updateStatus('disconnected');
          },

          onMessage: (message: { message: string; source: 'user' | 'ai' }) => {
            const text = message.message;

            if (!text) {
              return;
            }

            const role: 'user' | 'assistant' = message.source === 'ai' ? 'assistant' : 'user';
            const msg: VoiceMessage = { role, text, timestamp: Date.now() };
            setConversationHistory((prev) => [...prev, msg]);

            if (role === 'user') {
              setCurrentUserTranscript('');

              // In planning phase, check for build triggers
              if (phaseRef.current === 'planning') {
                checkForBuildTrigger(text, 'user');
              }

              // In coding phase, check for interruptions
              if (phaseRef.current === 'coding') {
                checkForInterruption(text);
              }
            } else {
              // Agent message — check for build triggers in planning phase
              if (phaseRef.current === 'planning') {
                checkForBuildTrigger(text, 'assistant');
              }
            }
          },

          onError: (error: any) => {
            console.error('[Voice] Error:', error);

            const errMsg = typeof error === 'string' ? error : error?.message || 'Voice connection error';
            updateStatus('error');
            options.onError?.(errMsg);
          },

          onModeChange: (mode: { mode: 'speaking' | 'listening' }) => {
            const isSpeaking = mode.mode === 'speaking';
            setIsAgentSpeaking(isSpeaking);

            if (phaseRef.current !== 'coding') {
              updateStatus(isSpeaking ? 'speaking' : 'listening');
            }
          },

          onStatusChange: (statusChange: any) => {
            console.log('[Voice] Status:', statusChange);
          },
        });

        conversationRef.current = conversation;
        updateStatus('listening');
      } catch (err: any) {
        console.error('[Voice] Failed to start:', err);
        updateStatus('error');
        options.onError?.(err.message || 'Failed to start voice session');
      }
    },
    [updateStatus, checkForBuildTrigger, checkForInterruption, options.onError],
  );

  /**
   * End the current voice session
   */
  const endSession = useCallback(async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch (e) {
        console.warn('[Voice] Error ending session:', e);
      }
      conversationRef.current = null;
    }

    setIsConnected(false);
    setIsAgentSpeaking(false);
    setCurrentUserTranscript('');
    setPhase('planning');
    setIsCoding(false);
    updateStatus('idle');
  }, [updateStatus]);

  /**
   * Manually trigger build with current conversation
   */
  const triggerBuild = useCallback(() => {
    if (buildTriggeredRef.current) {
      return;
    }

    buildTriggeredRef.current = true;
    setPhase('coding');
    setIsCoding(true);
    updateStatus('coding');

    const prompt = compilePrompt();

    if (prompt && options.onReadyToBuild) {
      options.onReadyToBuild(prompt);
    }

    // NOTE: We do NOT call endSession() — voice stays alive during coding
  }, [compilePrompt, options.onReadyToBuild, updateStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        try {
          conversationRef.current.endSession();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    // State
    status,
    phase,
    isConnected,
    isAgentSpeaking,
    isCoding,
    conversationHistory,
    currentUserTranscript,

    // Actions
    startSession,
    endSession,
    triggerBuild,
    feedCodingUpdate,
    notifyCodingComplete,
  };
}
