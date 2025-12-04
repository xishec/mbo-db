import { useCallback, useEffect, useRef, useState } from "react";

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onerror: ((event: Event & { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface VoiceCommand {
  // Phrases that trigger this command (lowercase)
  triggers: string[];
  // Action to execute when command is recognized
  action: () => void;
  // Description for help/tooltip
  description?: string;
}

export interface UseGlobalVoiceCommandsReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  lastCommand: string | null;
}

export function useGlobalVoiceCommands(
  commands: VoiceCommand[],
  enabled: boolean = true
): UseGlobalVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const commandsRef = useRef(commands);
  
  // Keep commands ref updated
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  const isSupported = typeof window !== "undefined" && 
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const processTranscript = useCallback((text: string) => {
    const lower = text.toLowerCase().trim();
    
    for (const command of commandsRef.current) {
      for (const trigger of command.triggers) {
        if (lower.includes(trigger)) {
          setLastCommand(trigger);
          command.action();
          return true;
        }
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (!isSupported || !enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      // Show interim results for visual feedback
      setTranscript(finalTranscript || interimTranscript);
      
      // Process final results for commands
      if (finalTranscript) {
        processTranscript(finalTranscript);
      }
    };
    
    recognition.onerror = (event) => {
      // Don't show error for "no-speech" as it's expected when user isn't speaking
      if (event.error !== "no-speech") {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if we want continuous listening
      // Uncomment below if you want it to auto-restart
      // if (enabled) {
      //   try { recognition.start(); } catch (e) {}
      // }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      recognition.abort();
    };
  }, [isSupported, enabled, processTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    setTranscript("");
    setLastCommand(null);
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("Failed to stop recognition:", err);
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
    lastCommand,
  };
}
