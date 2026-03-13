import React, { useState, useRef, useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import type { ProviderInfo } from '~/types/model';
import { ColorSchemeDialog } from '~/components/ui/ColorSchemeDialog';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { McpTools } from './MCPTools';
import { WebSearch } from './WebSearch.client';

// Clean up long model IDs to shorter display names
function formatModelName(model: string | undefined): string {
  if (!model) {
    return 'Select model';
  }

  // Common model name cleanups
  const cleanups: [RegExp, string][] = [
    [/^claude-sonnet-4-5-(\d+)$/, 'Claude Sonnet 4.5'],
    [/^claude-opus-4-(\d+)$/, 'Claude Opus 4'],
    [/^claude-sonnet-4-(\d+)$/, 'Claude Sonnet 4'],
    [/^claude-3-5-sonnet-(\d+)$/, 'Claude 3.5 Sonnet'],
    [/^claude-3-opus-(\d+)$/, 'Claude 3 Opus'],
    [/^claude-3-haiku-(\d+)$/, 'Claude 3 Haiku'],
    [/^gpt-4o-(.+)$/, 'GPT-4o'],
    [/^gpt-4-(.+)$/, 'GPT-4'],
    [/^gpt-3\.5-(.+)$/, 'GPT-3.5'],
  ];

  for (const [pattern, replacement] of cleanups) {
    if (pattern.test(model)) {
      return model.replace(pattern, replacement);
    }
  }

  // Handle gemini models
  if (model.startsWith('gemini-')) {
    const name = model
      .replace(/^gemini-/, '')
      .replace(/-\d{4,}$/, '')
      .replace(/-/g, ' ');
    return `Gemini ${name.charAt(0).toUpperCase() + name.slice(1)}`;
  }

  // Fallback: remove trailing date-like numbers and clean up
  return model
    .replace(/-\d{8,}$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  onWebSearchResult?: (result: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isVoiceAgentMode, setIsVoiceAgentMode] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Rachel');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setModeDropdownOpen(false);
      }

      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={classNames('relative w-full max-w-chat mx-auto z-prompt')}>
      {/* GitHub Copilot multi-layered gradient glow behind the input — only on landing page */}
      {!props.chatStarted && (
        <div className="absolute -inset-[120px] -z-10 pointer-events-none" aria-hidden="true">
          {/* Layer 1: Deep purple base wash */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 50% 60%, #130138 0%, transparent 70%)',
              opacity: 0.9,
            }}
          />
          {/* Layer 2: Rich purple mid layer */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 55% 45% at 45% 55%, #240263 0%, transparent 65%)',
              opacity: 0.8,
            }}
          />
          {/* Layer 3: Electric violet core left */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 40% 35% at 30% 50%, #3602c7 0%, transparent 60%)',
              opacity: 0.7,
            }}
          />
          {/* Layer 4: Blue-indigo bloom right */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 40% 35% at 70% 50%, #271ee3 0%, transparent 60%)',
              opacity: 0.65,
            }}
          />
          {/* Layer 5: Cyan-blue highlight top */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 50% 30% at 60% 35%, #2784d6 0%, transparent 55%)',
              opacity: 0.5,
            }}
          />
          {/* Layer 6: Soft purple-blue sweep across */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'conic-gradient(from 180deg at 50% 55%, #130138 0deg, #240263 60deg, #3602c7 120deg, #271ee3 200deg, #2784d6 270deg, #130138 360deg)',
              opacity: 0.3,
              filter: 'blur(60px)',
            }}
          />
          {/* Layer 7: Ambient outer glow */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 55%, rgba(54, 2, 199, 0.25) 0%, rgba(39, 132, 214, 0.1) 40%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>
      )}

      {/* Main Copilot-style input container */}
      <div className="rounded-lg border border-[#3d3d3d]/60 bg-[#303030] overflow-hidden">
        {/* Top bar: Add Context button */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
          <button
            onClick={() => props.handleFileUpload()}
            className="flex items-center gap-1.5 px-2 py-0.5 text-[13px] text-[#8b949e] hover:text-[#c9d1d9] bg-transparent hover:bg-[#3d3d3d] rounded transition-colors"
          >
            <div className="i-ph:paperclip text-sm" />
            <span>Add Context...</span>
          </button>
        </div>

        <FilePreview
          files={props.uploadedFiles}
          imageDataList={props.imageDataList}
          onRemove={(index) => {
            props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
            props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
          }}
        />
        <ClientOnly>
          {() => (
            <ScreenshotStateManager
              setUploadedFiles={props.setUploadedFiles}
              setImageDataList={props.setImageDataList}
              uploadedFiles={props.uploadedFiles}
              imageDataList={props.imageDataList}
            />
          )}
        </ClientOnly>
        {props.selectedElement && (
          <div className="flex mx-3 gap-2 items-center justify-between rounded-md border border-[#3d3d3d] text-[#c9d1d9] py-1 px-2.5 font-medium text-xs">
            <div className="flex gap-2 items-center lowercase">
              <code className="bg-accent-500 rounded px-1.5 py-0.5 text-white text-xs">
                {props?.selectedElement?.tagName}
              </code>
              selected for inspection
            </div>
            <button
              className="bg-transparent text-accent-500 hover:text-accent-400"
              onClick={() => props.setSelectedElement?.(null)}
            >
              Clear
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="relative px-3 py-1">
          <textarea
            ref={props.textareaRef}
            className={classNames(
              'w-full pl-1 pr-4 outline-none resize-none bg-transparent text-[13px] text-[#c9d1d9] placeholder-[#484f58]',
              'transition-all duration-200',
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              e.currentTarget.style.border = '2px solid #1488fc';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.border = '2px solid #1488fc';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.style.border = 'none';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.border = 'none';

              const files = Array.from(e.dataTransfer.files);
              files.forEach((file) => {
                if (file.type.startsWith('image/')) {
                  const reader = new FileReader();

                  reader.onload = (ev) => {
                    const base64Image = ev.target?.result as string;
                    props.setUploadedFiles?.([...props.uploadedFiles, file]);
                    props.setImageDataList?.([...props.imageDataList, base64Image]);
                  };
                  reader.readAsDataURL(file);
                }
              });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (event.shiftKey) {
                  return;
                }

                event.preventDefault();

                if (props.isStreaming) {
                  props.handleStop?.();
                  return;
                }

                if (event.nativeEvent.isComposing) {
                  return;
                }

                props.handleSendMessage?.(event);
              }
            }}
            value={props.input}
            onChange={(event) => {
              props.handleInputChange?.(event);
            }}
            onPaste={props.handlePaste}
            style={{
              minHeight: props.TEXTAREA_MIN_HEIGHT,
              maxHeight: props.TEXTAREA_MAX_HEIGHT,
            }}
            placeholder={
              isVoiceAgentMode
                ? 'Press the voice button to start talking...'
                : props.chatMode === 'build'
                  ? 'Edit files in your workspace in agent mode'
                  : 'What would you like to discuss?'
            }
            translate="no"
          />
        </div>

        {/* Bottom toolbar - Copilot style */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          {/* Left side: mode & model selectors */}
          <div className="flex items-center gap-3">
            {/* Agent/Mode dropdown */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                onClick={() => {
                  setModeDropdownOpen(!modeDropdownOpen);
                  setModelDropdownOpen(false);
                }}
                className="flex items-center gap-1 text-[13px] text-[#c9d1d9] hover:text-white bg-transparent border-none cursor-pointer transition-colors"
              >
                <span className="font-medium">
                  {isVoiceAgentMode ? 'Voice Agent' : props.chatMode === 'discuss' ? 'Ask' : 'Agent'}
                </span>
                <div className="i-ph:caret-down text-[10px] text-[#8b949e]" />
              </button>

              {/* Mode dropdown popup */}
              {modeDropdownOpen && (
                <div
                  className="fixed w-[220px] bg-[#303030] border border-[#3d3d3d] rounded-md shadow-xl z-[9999] py-1 text-[13px]"
                  style={{
                    bottom: `${window.innerHeight - (modeDropdownRef.current?.getBoundingClientRect().top ?? 0) + 4}px`,
                    left: `${modeDropdownRef.current?.getBoundingClientRect().left ?? 0}px`,
                  }}
                >
                  <div className="px-3 py-1.5 text-[#8b949e] text-[11px] font-semibold uppercase tracking-wide">
                    Built-In
                  </div>
                  <button
                    onClick={() => {
                      props.setChatMode?.('build');
                      setIsVoiceAgentMode(false);
                      setIsVoiceActive(false);
                      setModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center">
                        {props.chatMode === 'build' && !isVoiceAgentMode ? '✓' : ''}
                      </span>
                      <span>Agent</span>
                    </div>
                    <span className="text-[11px] text-[#484f58]">⇧⌘I</span>
                  </button>
                  <button
                    onClick={() => {
                      props.setChatMode?.('build');
                      setIsVoiceAgentMode(true);
                      setModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center">{isVoiceAgentMode ? '✓' : ''}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="i-ph:microphone text-sm" />
                        <span>Voice Agent</span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      props.setChatMode?.('discuss');
                      setIsVoiceAgentMode(false);
                      setIsVoiceActive(false);
                      setModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center">
                        {props.chatMode === 'discuss' && !isVoiceAgentMode ? '✓' : ''}
                      </span>
                      <span>Ask</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setIsVoiceAgentMode(false);
                      setIsVoiceActive(false);
                      setModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-3 py-1.5 text-left text-[#c9d1d9] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-center" />
                      <span>Edit</span>
                    </div>
                  </button>
                  <div className="border-t border-[#3d3d3d] my-1" />
                  <button
                    onClick={() => {
                      props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed);
                      setModeDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-3 py-1.5 text-left text-[#58a6ff] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4" />
                      <span>Configure Modes...</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Model / Voice dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => {
                  setModelDropdownOpen(!modelDropdownOpen);
                  setModeDropdownOpen(false);
                }}
                className="flex items-center gap-1 text-[13px] text-[#8b949e] hover:text-[#c9d1d9] bg-transparent border-none cursor-pointer transition-colors"
              >
                <span>{isVoiceAgentMode ? selectedVoice : formatModelName(props.model)}</span>
                <div className="i-ph:caret-down text-[10px] text-[#8b949e]" />
              </button>

              {/* Model/Voice dropdown popup */}
              {modelDropdownOpen && !isVoiceAgentMode && (
                <ModelDropdownPopup
                  modelList={props.modelList}
                  currentModel={props.model}
                  anchorRef={modelDropdownRef}
                  onSelectModel={(modelName) => {
                    props.setModel?.(modelName);
                    setModelDropdownOpen(false);
                  }}
                  onManageModels={() => {
                    props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed);
                    setModelDropdownOpen(false);
                  }}
                />
              )}
              {modelDropdownOpen && isVoiceAgentMode && (
                <VoiceDropdownPopup
                  currentVoice={selectedVoice}
                  anchorRef={modelDropdownRef}
                  onSelectVoice={(voice) => {
                    setSelectedVoice(voice);
                    setModelDropdownOpen(false);
                  }}
                />
              )}
            </div>
          </div>

          {/* Right side: action icons + send */}
          <div className="flex items-center gap-1">
            {/* Voice Agent button - prominent when voice mode is active */}
            {isVoiceAgentMode && (
              <>
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                  @keyframes voiceBar1 { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
                  @keyframes voiceBar2 { 0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(0.3); } }
                  @keyframes voiceBar3 { 0%, 100% { transform: scaleY(0.8); } 50% { transform: scaleY(0.5); } }
                  @keyframes voiceBar4 { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(0.9); } }
                  @keyframes voiceBar5 { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(0.7); } }
                `,
                  }}
                />
                <button
                  onClick={() => setIsVoiceActive(!isVoiceActive)}
                  className={classNames(
                    'flex items-center justify-center w-[34px] h-[34px] rounded-full transition-all border-none cursor-pointer mr-1',
                    isVoiceActive
                      ? 'bg-white text-[#0d1117] shadow-lg scale-105'
                      : 'bg-[#3d3d3d] text-[#c9d1d9] hover:bg-[#4a4a4a] hover:text-white',
                  )}
                  style={isVoiceActive ? { boxShadow: '0 0 12px rgba(255,255,255,0.25)' } : {}}
                  title={isVoiceActive ? 'Stop voice agent' : 'Start voice agent'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect
                      x="2"
                      y="6"
                      width="2.5"
                      height="12"
                      rx="1.25"
                      fill="currentColor"
                      style={
                        isVoiceActive
                          ? { transformOrigin: 'center', animation: 'voiceBar1 0.8s ease-in-out infinite' }
                          : { transform: 'scaleY(0.5)', transformOrigin: 'center' }
                      }
                    />
                    <rect
                      x="6.5"
                      y="3"
                      width="2.5"
                      height="18"
                      rx="1.25"
                      fill="currentColor"
                      style={
                        isVoiceActive
                          ? { transformOrigin: 'center', animation: 'voiceBar2 0.6s ease-in-out infinite' }
                          : { transform: 'scaleY(0.7)', transformOrigin: 'center' }
                      }
                    />
                    <rect
                      x="11"
                      y="5"
                      width="2.5"
                      height="14"
                      rx="1.25"
                      fill="currentColor"
                      style={
                        isVoiceActive
                          ? { transformOrigin: 'center', animation: 'voiceBar3 0.7s ease-in-out infinite' }
                          : { transform: 'scaleY(0.6)', transformOrigin: 'center' }
                      }
                    />
                    <rect
                      x="15.5"
                      y="2"
                      width="2.5"
                      height="20"
                      rx="1.25"
                      fill="currentColor"
                      style={
                        isVoiceActive
                          ? { transformOrigin: 'center', animation: 'voiceBar4 0.5s ease-in-out infinite' }
                          : { transform: 'scaleY(0.8)', transformOrigin: 'center' }
                      }
                    />
                    <rect
                      x="20"
                      y="7"
                      width="2.5"
                      height="10"
                      rx="1.25"
                      fill="currentColor"
                      style={
                        isVoiceActive
                          ? { transformOrigin: 'center', animation: 'voiceBar5 0.9s ease-in-out infinite' }
                          : { transform: 'scaleY(0.5)', transformOrigin: 'center' }
                      }
                    />
                  </svg>
                </button>
              </>
            )}
            <ColorSchemeDialog designScheme={props.designScheme} setDesignScheme={props.setDesignScheme} />
            <McpTools />
            <WebSearch onSearchResult={(result) => props.onWebSearchResult?.(result)} disabled={props.isStreaming} />
            <IconButton
              title="Enhance prompt"
              disabled={props.input.length === 0 || props.enhancingPrompt}
              className={classNames('transition-all', props.enhancingPrompt ? 'opacity-100' : '')}
              onClick={() => {
                props.enhancePrompt?.();
                toast.success('Prompt enhanced!');
              }}
            >
              {props.enhancingPrompt ? (
                <div className="i-svg-spinners:90-ring-with-bg text-base animate-spin"></div>
              ) : (
                <div className="i-bolt:stars text-base"></div>
              )}
            </IconButton>
            <SpeechRecognitionButton
              isListening={props.isListening}
              onStart={props.startListening}
              onStop={props.stopListening}
              disabled={props.isStreaming}
            />

            {/* Send / Stop button */}
            <button
              onClick={(event) => {
                if (props.isStreaming) {
                  props.handleStop?.();
                  return;
                }

                if (props.input.length > 0 || props.uploadedFiles.length > 0) {
                  props.handleSendMessage?.(event);
                }
              }}
              disabled={!props.providerList || props.providerList.length === 0}
              className={classNames(
                'flex items-center justify-center w-[26px] h-[26px] rounded transition-all bg-transparent border-none',
                props.input.length > 0 || props.isStreaming || props.uploadedFiles.length > 0
                  ? 'text-[#c9d1d9] hover:text-white cursor-pointer'
                  : 'text-[#484f58] cursor-default',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {props.isStreaming ? (
                <div className="i-ph:stop-fill text-base" />
              ) : (
                <div className="i-ph:play-fill text-base" />
              )}
            </button>
            <div className="i-ph:caret-down text-[10px] text-[#484f58] -ml-1" />
          </div>
        </div>
      </div>
      <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
    </div>
  );
};

// Model dropdown popup component matching GitHub Copilot's design
interface ModelDropdownPopupProps {
  modelList: any[];
  currentModel: string | undefined;
  onSelectModel: (modelName: string) => void;
  onManageModels: () => void;
  anchorRef?: React.RefObject<HTMLDivElement>;
}

// Group models by provider for display
function groupModelsByProvider(modelList: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  for (const m of modelList) {
    const provider = m.provider || 'Other';

    if (!groups[provider]) {
      groups[provider] = [];
    }

    groups[provider].push(m);
  }

  return groups;
}

function ModelDropdownPopup({
  modelList,
  currentModel,
  onSelectModel,
  onManageModels,
  anchorRef,
}: ModelDropdownPopupProps) {
  const grouped = groupModelsByProvider(modelList);
  const providers = Object.keys(grouped).sort();

  const rect = anchorRef?.current?.getBoundingClientRect();

  return (
    <div
      className="fixed w-[340px] max-h-[420px] overflow-y-auto bg-[#303030] border border-[#3d3d3d] rounded-md shadow-xl z-[9999] py-1 text-[13px]"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#3d3d3d transparent',
        bottom: rect ? `${window.innerHeight - rect.top + 4}px` : undefined,
        left: rect ? `${rect.left}px` : undefined,
      }}
    >
      {providers.map((providerName) => (
        <div key={providerName}>
          <div className="px-3 py-1.5 text-[#8b949e] text-[11px] font-semibold uppercase tracking-wide">
            {providerName}
          </div>
          {grouped[providerName].map((model: any) => {
            const isSelected = model.name === currentModel;

            return (
              <button
                key={model.name}
                onClick={() => onSelectModel(model.name)}
                className={classNames(
                  'w-full flex items-center justify-between px-3 py-1.5 text-left bg-transparent border-none cursor-pointer transition-colors',
                  isSelected ? 'text-[#c9d1d9] bg-[#1f6feb]/20' : 'text-[#c9d1d9] hover:bg-[#1f6feb]/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center text-sm">{isSelected ? '✓' : ''}</span>
                  <span>{model.label || formatModelName(model.name)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {modelList.length === 0 && (
        <div className="px-3 py-3 text-[#8b949e] text-center">No models available. Configure a provider first.</div>
      )}

      <div className="border-t border-[#3d3d3d] my-1" />
      <button
        onClick={onManageModels}
        className="w-full flex items-center px-3 py-1.5 text-left text-[#58a6ff] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-4" />
          <span>Manage Models...</span>
        </div>
      </button>
    </div>
  );
}

// ElevenLabs Voices for Voice Agent mode
const ELEVENLABS_VOICES = {
  Conversational: [
    { name: 'Rachel', description: 'Calm, warm female', accent: 'American' },
    { name: 'Drew', description: 'Confident, well-rounded male', accent: 'American' },
    { name: 'Clyde', description: 'Gruff, deep male', accent: 'American' },
    { name: 'Paul', description: 'Ground, narration male', accent: 'American' },
    { name: 'Domi', description: 'Strong, clear female', accent: 'American' },
    { name: 'Dave', description: 'Conversational, British male', accent: 'British-Essex' },
    { name: 'Fin', description: 'Lively, Irish male', accent: 'Irish' },
    { name: 'Sarah', description: 'Soft, news female', accent: 'American' },
    { name: 'Antoni', description: 'Crisp, well-rounded male', accent: 'American' },
    { name: 'Thomas', description: 'Calm, steady male', accent: 'American' },
    { name: 'Charlie', description: 'Casual, Australian male', accent: 'Australian' },
    { name: 'Emily', description: 'Calm, sweet female', accent: 'American' },
  ],
  Narration: [
    { name: 'Aria', description: 'Expressive, broadcast female', accent: 'American' },
    { name: 'Roger', description: 'Deep, confident male', accent: 'American' },
    { name: 'Jessica', description: 'Expressive, engaging female', accent: 'American' },
    { name: 'Eric', description: 'Friendly, middle-aged male', accent: 'American' },
    { name: 'Chris', description: 'Casual, smooth male', accent: 'American' },
    { name: 'Brian', description: 'Deep, narrator male', accent: 'American' },
    { name: 'Daniel', description: 'Authoritative, British male', accent: 'British' },
    { name: 'Lily', description: 'Warm, British female', accent: 'British' },
    { name: 'Bill', description: 'Trustworthy, documentary male', accent: 'American' },
  ],
};

interface VoiceDropdownPopupProps {
  currentVoice: string;
  anchorRef?: React.RefObject<HTMLDivElement>;
  onSelectVoice: (voice: string) => void;
}

function VoiceDropdownPopup({ currentVoice, anchorRef, onSelectVoice }: VoiceDropdownPopupProps) {
  const rect = anchorRef?.current?.getBoundingClientRect();

  return (
    <div
      className="fixed w-[320px] max-h-[420px] overflow-y-auto bg-[#303030] border border-[#3d3d3d] rounded-md shadow-xl z-[9999] py-1 text-[13px]"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#3d3d3d transparent',
        bottom: rect ? `${window.innerHeight - rect.top + 4}px` : undefined,
        left: rect ? `${rect.left}px` : undefined,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[#3d3d3d] mb-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="9" width="2.5" height="6" rx="1.25" fill="#8b949e" />
          <rect x="6.5" y="6" width="2.5" height="12" rx="1.25" fill="#8b949e" />
          <rect x="11" y="8" width="2.5" height="8" rx="1.25" fill="#8b949e" />
          <rect x="15.5" y="5" width="2.5" height="14" rx="1.25" fill="#8b949e" />
          <rect x="20" y="9" width="2.5" height="6" rx="1.25" fill="#8b949e" />
        </svg>
        <span className="text-[12px] text-[#8b949e] font-semibold">ElevenLabs Agents</span>
      </div>

      {Object.entries(ELEVENLABS_VOICES).map(([category, voices]) => (
        <div key={category}>
          <div className="px-3 py-1.5 text-[#8b949e] text-[11px] font-semibold uppercase tracking-wide">{category}</div>
          {voices.map((voice) => {
            const isSelected = voice.name === currentVoice;

            return (
              <button
                key={voice.name}
                onClick={() => onSelectVoice(voice.name)}
                className={classNames(
                  'w-full flex items-center justify-between px-3 py-1.5 text-left bg-transparent border-none cursor-pointer transition-colors',
                  isSelected ? 'text-[#c9d1d9] bg-[#1f6feb]/20' : 'text-[#c9d1d9] hover:bg-[#1f6feb]/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center text-sm">{isSelected ? '✓' : ''}</span>
                  <div className="flex flex-col">
                    <span>{voice.name}</span>
                    <span className="text-[10px] text-[#484f58]">{voice.description}</span>
                  </div>
                </div>
                <span className="text-[10px] text-[#484f58] bg-[#3d3d3d] px-1.5 py-0.5 rounded">{voice.accent}</span>
              </button>
            );
          })}
        </div>
      ))}

      <div className="border-t border-[#3d3d3d] my-1" />
      <button className="w-full flex items-center px-3 py-1.5 text-left text-[#58a6ff] hover:bg-[#1f6feb]/30 bg-transparent border-none cursor-pointer transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-4" />
          <span>Manage Voices...</span>
        </div>
      </button>
    </div>
  );
}
