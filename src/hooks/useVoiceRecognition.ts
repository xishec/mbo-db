import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptureFormData } from "../types";

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

// Field name mappings from voice to form field keys
const FIELD_VOICE_MAPPINGS: Record<string, keyof CaptureFormData> = {
  // Band fields - "full band" or just "band" for complete 9-digit band number
  // These all map to a special handler that will split into bandGroup and bandLastTwoDigits
  band: "bandGroup",
  bend: "bandGroup",
  ben: "bandGroup", // "band" often heard as "Ben"

  // Species
  species: "species",
  bird: "species",

  // Measurements
  wing: "wing",
  when: "wing",
  weight: "weight",
  wait: "weight", // Common mishearing of "weight"
  wade: "weight", // Another mishearing
  mass: "weight",

  // Age/Sex
  age: "age",
  h: "age",
  8: "age",
  "how aged": "howAged",
  aged: "howAged",
  sex: "sex",
  six: "sex",
  "6": "sex", // "sex" often heard as "6"
  sax: "sex", // Another mishearing
  set: "sex", // Another mishearing
  "how sexed": "howSexed",
  sexed: "howSexed",

  // Fat
  fat: "fat",
  "that": "fat",

  // Personnel
  thunder: "bander",
  bender: "bander",
  bander: "bander",
  scribe: "scribe",

  // Location/Time
  net: "net",
  date: "date",
  time: "time",

  // Notes
  notes: "notes",
  note: "notes",
  comment: "notes",
};

// Word to number mappings for spoken numbers
const WORD_TO_NUMBER: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  to: "2",
  too: "2",
  three: "3",
  four: "4",
  for: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "00",
  point: ".",
  dot: ".",
  decimal: ".",
};

// NATO phonetic alphabet to letters
const NATO_TO_LETTER: Record<string, string> = {
  alpha: "A",
  bravo: "B",
  charlie: "C",
  delta: "D",
  echo: "E",
  foxtrot: "F",
  golf: "G",
  hotel: "H",
  india: "I",
  juliet: "J",
  kilo: "K",
  lima: "L",
  mike: "M",
  november: "N",
  oscar: "O",
  papa: "P",
  quebec: "Q",
  romeo: "R",
  sierra: "S",
  tango: "T",
  uniform: "U",
  victor: "V",
  whiskey: "W",
  "x-ray": "X",
  xray: "X",
  yankee: "Y",
  zulu: "Z",
};

export interface VoiceRecognitionResult {
  field: keyof CaptureFormData | null;
  value: string;
  rawTranscript: string;
  // For commands that set multiple fields (like full band number)
  additionalFields?: { field: keyof CaptureFormData; value: string }[];
}

export interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  lastResult: VoiceRecognitionResult | null;
}

function parseTranscript(transcript: string): VoiceRecognitionResult {
  const lower = transcript.toLowerCase().trim();

  // Try to find a field name at the START of the transcript
  let detectedField: keyof CaptureFormData | null = null;
  let valueStartIndex = 0;

  // Sort field mappings by length (longest first) to match more specific phrases first
  const sortedMappings = Object.entries(FIELD_VOICE_MAPPINGS).sort(([a], [b]) => b.length - a.length);

  for (const [voicePhrase, fieldKey] of sortedMappings) {
    // Only match if the field name is at the beginning of the transcript
    // This prevents "notes this is a fat bird" from matching "fat" as a field
    // Also require a word boundary after the field name (space or end of string)
    if (lower.startsWith(voicePhrase)) {
      const afterField = lower.charAt(voicePhrase.length);
      // Must be followed by space, end of string, or common separators
      if (afterField === '' || afterField === ' ' || afterField === ':' || afterField === ',') {
        detectedField = fieldKey;
        valueStartIndex = voicePhrase.length;
        break;
      }
    }
  }

  // Extract the value part (everything after the field name)
  let valueText = lower.slice(valueStartIndex).trim();

  // Remove common filler words
  valueText = valueText.replace(/^(is|equals|equals to|set to|set|to|:)\s*/i, "");

  // If no field detected, try to extract just numbers/letters as a raw value
  // This handles the case where user says just "1234567" after saying "band group"
  let rawValue = "";
  if (!detectedField) {
    rawValue = extractRawValue(lower);
  }

  // Convert the value based on detected field type
  const parsedValue = detectedField ? convertVoiceToValue(valueText, detectedField) : rawValue;

  // Check if this is a full band number for "band" or "band number" or "band group" field
  // If 9 digits: split into bandGroup (first 7 digits formatted as XXXX-XXX) and bandLastTwoDigits (last 2)
  // If 7-8 digits: just set bandGroup
  // If 2 digits: just set bandLastTwoDigits
  if (detectedField === "bandLastTwoDigits" || detectedField === "bandGroup") {
    const digits = parsedValue.replace(/\D/g, "");

    // Full 9-digit band number - split into bandGroup and bandLastTwoDigits
    if (digits.length >= 9) {
      const bandGroupDigits = digits.slice(0, 7);
      const bandLastTwo = digits.slice(7, 9);
      const formattedBandGroup = `${bandGroupDigits.slice(0, 4)}-${bandGroupDigits.slice(4, 7)}`;

      return {
        field: "bandGroup",
        value: formattedBandGroup,
        rawTranscript: transcript,
        additionalFields: [{ field: "bandLastTwoDigits", value: bandLastTwo }],
      };
    }

    // 7-8 digit band group only
    if (digits.length >= 7) {
      const bandGroupDigits = digits.slice(0, 7);
      const formattedBandGroup = `${bandGroupDigits.slice(0, 4)}-${bandGroupDigits.slice(4, 7)}`;
      return {
        field: "bandGroup",
        value: formattedBandGroup,
        rawTranscript: transcript,
      };
    }

    // 2 digits only - set bandLastTwoDigits (for "last two" field)
    if (detectedField === "bandLastTwoDigits" && digits.length === 2) {
      return {
        field: "bandLastTwoDigits",
        value: digits,
        rawTranscript: transcript,
      };
    }
  }

  // Check if sex has 2 digits - split into sex and howSexed
  // Handle both "12" and "twelve" as separate digits
  if (detectedField === "sex") {
    const digits = parsedValue.replace(/\D/g, "");
    if (digits.length >= 2) {
      return {
        field: "sex",
        value: digits[0],
        rawTranscript: transcript,
        additionalFields: [{ field: "howSexed", value: digits[1] }],
      };
    }
  }

  // Check if age has 2 digits - split into age and howAged
  // Handle both "21" and "twenty one" as separate digits
  if (detectedField === "age") {
    const digits = parsedValue.replace(/\D/g, "");
    if (digits.length >= 2) {
      return {
        field: "age",
        value: digits[0],
        rawTranscript: transcript,
        additionalFields: [{ field: "howAged", value: digits[1] }],
      };
    }
  }

  return {
    field: detectedField,
    value: parsedValue,
    rawTranscript: transcript,
  };
}

// Extract raw numeric or letter value from transcript (for continuation after pause)
function extractRawValue(text: string): string {
  const words = text.split(/\s+/);
  let result = "";

  for (const word of words) {
    const lowerWord = word.toLowerCase();

    // Direct number
    if (/^\d+\.?\d*$/.test(word)) {
      result += word;
    }
    // Word to number conversion
    else if (WORD_TO_NUMBER[lowerWord]) {
      const num = WORD_TO_NUMBER[lowerWord];
      if (num === ".") {
        result += ".";
      } else if (num === "00" && result.length > 0) {
        const prev = parseInt(result, 10);
        result = String(prev * 100);
      } else {
        const lastNum = parseInt(num, 10);
        if (result.length > 0) {
          const prevNum = parseInt(result, 10);
          if (prevNum % 10 === 0 && lastNum < 10 && prevNum < 100) {
            result = String(prevNum + lastNum);
          } else {
            result += num;
          }
        } else {
          result = num;
        }
      }
    }
    // NATO phonetic
    else if (NATO_TO_LETTER[lowerWord]) {
      result += NATO_TO_LETTER[lowerWord];
    }
    // Single letter
    else if (word.length === 1 && /[a-zA-Z]/.test(word)) {
      result += word.toUpperCase();
    }
  }

  return result;
}

function convertVoiceToValue(text: string, field: keyof CaptureFormData | null): string {
  const words = text.split(/\s+/);
  let result = "";

  // For letter-based fields (species, bander, scribe)
  const letterFields: (keyof CaptureFormData)[] = ["species", "bander", "scribe"];
  if (field && letterFields.includes(field)) {
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      // Check NATO phonetic
      if (NATO_TO_LETTER[lowerWord]) {
        result += NATO_TO_LETTER[lowerWord];
      }
      // Check if it's a single letter
      else if (word.length === 1 && /[a-zA-Z]/.test(word)) {
        result += word.toUpperCase();
      }
      // Try to interpret as letters spelled out
      else if (lowerWord.length > 1) {
        // Could be multiple letters spoken as one word
        for (const char of lowerWord) {
          if (/[a-z]/.test(char)) {
            result += char.toUpperCase();
          }
        }
      }
    }
    return result;
  }

  // For alphanumeric fields (net can be like "C1", "A2", "12", etc.)
  const alphanumericFields: (keyof CaptureFormData)[] = ["net"];
  if (field && alphanumericFields.includes(field)) {
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      // Direct alphanumeric value (like "C1", "A2")
      if (/^[a-zA-Z0-9]+$/.test(word)) {
        result += word.toUpperCase();
      }
      // NATO phonetic to letter
      else if (NATO_TO_LETTER[lowerWord]) {
        result += NATO_TO_LETTER[lowerWord];
      }
      // Word to number conversion
      else if (WORD_TO_NUMBER[lowerWord] && WORD_TO_NUMBER[lowerWord] !== ".") {
        result += WORD_TO_NUMBER[lowerWord];
      }
    }
    return result;
  }

  // For numeric fields
  const numericFields: (keyof CaptureFormData)[] = [
    "bandGroup",
    "bandLastTwoDigits",
    "wing",
    "age",
    "howAged",
    "sex",
    "howSexed",
    "fat",
    "weight",
  ];

  if (field && numericFields.includes(field)) {
    let numberBuffer = "";

    // For band fields, we want to concatenate individual digits
    const isBandField = field === "bandGroup" || field === "bandLastTwoDigits";

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Direct number (including numbers with hyphens, colons, or other punctuation like "1462-06845" or "2731-168:35")
      if (/^[\d.:\-/]+$/.test(word) && /\d/.test(word)) {
        // Extract just the digits
        numberBuffer += word.replace(/\D/g, "");
      }
      // Direct number without punctuation
      else if (/^\d+\.?\d*$/.test(word)) {
        numberBuffer += word;
      }
      // Word to number conversion
      else if (WORD_TO_NUMBER[lowerWord]) {
        const num = WORD_TO_NUMBER[lowerWord];
        if (num === ".") {
          numberBuffer += ".";
        } else if (num === "00" && numberBuffer.length > 0) {
          // "hundred" multiplies the previous number
          const prev = parseInt(numberBuffer, 10);
          numberBuffer = String(prev * 100);
        } else {
          const lastNum = parseInt(num, 10);

          // For band fields, always concatenate digits (e.g., "one two three" -> "123")
          if (isBandField && lastNum < 10) {
            numberBuffer += num;
          }
          // For other fields, handle compound numbers like "twenty one"
          else if (numberBuffer.length > 0) {
            const prevNum = parseInt(numberBuffer, 10);
            // If previous ends in 0 and current is < 10, add them
            if (prevNum % 10 === 0 && lastNum < 10 && prevNum < 100) {
              numberBuffer = String(prevNum + lastNum);
            } else {
              numberBuffer += num;
            }
          } else {
            numberBuffer = num;
          }
        }
      }
    }

    // For band fields, return raw digits - let parseTranscript handle the formatting and splitting
    if (isBandField) {
      return numberBuffer;
    }

    return numberBuffer;
  }

  // For notes or other text fields, return as-is (preserve original text)
  return text;
}

// Time window (ms) to consider a follow-up utterance as continuation
// After saying a field name, user has this long to provide the value
const CONTINUATION_WINDOW = 5000;  // 5 seconds
const NOTES_CONTINUATION_WINDOW = 5000; // 5 seconds for notes

export function useVoiceRecognition(): UseVoiceRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VoiceRecognitionResult | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Track pending field when user says field name but pauses before value
  const pendingFieldRef = useRef<{ field: keyof CaptureFormData; timestamp: number } | null>(null);
  
  // Track if we want to keep listening (for auto-restart on no-speech)
  const shouldKeepListeningRef = useRef(false);

  const isSupported = typeof window !== "undefined" && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  useEffect(() => {
    if (!isSupported) return;

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

      // Only parse final results
      if (finalTranscript) {
        let parsed = parseTranscript(finalTranscript);
        const lowerTranscript = finalTranscript.toLowerCase().trim();

        // Check if we have a pending field and this utterance has no field but has a value
        const now = Date.now();
        const continuationWindow = pendingFieldRef.current?.field === "notes" 
          ? NOTES_CONTINUATION_WINDOW 
          : CONTINUATION_WINDOW;
        if (pendingFieldRef.current && now - pendingFieldRef.current.timestamp < continuationWindow) {
          const pendingField = pendingFieldRef.current.field;
          const isTextField = pendingField === "notes";
          
          // For notes field: ALWAYS use the raw transcript as the value, regardless of what was parsed
          // This prevents "this is a fat bird" from matching "fat" as a field
          // For other fields: only use continuation if no field was detected
          if (isTextField || !parsed.field) {
            const valueToUse = isTextField ? lowerTranscript : (parsed.value || lowerTranscript);
            
            if (valueToUse) {
              // Re-parse with the pending field context
              parsed = {
                ...parsed,
                field: pendingField,
                value: isTextField ? lowerTranscript : convertVoiceToValue(valueToUse, pendingField),
                rawTranscript: finalTranscript,
              };

              // Check for full band number split
              if ((parsed.field === "bandLastTwoDigits" || parsed.field === "bandGroup") && parsed.value) {
                const digits = parsed.value.replace(/\D/g, "");
                if (digits.length >= 9) {
                  const bandGroupDigits = digits.slice(0, 7);
                  const bandLastTwo = digits.slice(7, 9);
                  const formattedBandGroup = `${bandGroupDigits.slice(0, 4)}-${bandGroupDigits.slice(4, 7)}`;

                  parsed = {
                    field: "bandGroup",
                    value: formattedBandGroup,
                    rawTranscript: finalTranscript,
                    additionalFields: [{ field: "bandLastTwoDigits", value: bandLastTwo }],
                  };
                } else if (digits.length >= 7) {
                  const bandGroupDigits = digits.slice(0, 7);
                  const formattedBandGroup = `${bandGroupDigits.slice(0, 4)}-${bandGroupDigits.slice(4, 7)}`;

                  parsed = {
                    field: "bandGroup",
                    value: formattedBandGroup,
                    rawTranscript: finalTranscript,
                  };
                }
              }

              // Check for age splitting (2 digits -> age + howAged)
              if (parsed.field === "age" && parsed.value) {
                const digits = parsed.value.replace(/\D/g, "");
                if (digits.length >= 2) {
                  parsed = {
                    field: "age",
                    value: digits[0],
                    rawTranscript: finalTranscript,
                    additionalFields: [{ field: "howAged", value: digits[1] }],
                  };
                }
              }

              // Check for sex splitting (2 digits -> sex + howSexed)
              if (parsed.field === "sex" && parsed.value) {
                const digits = parsed.value.replace(/\D/g, "");
                if (digits.length >= 2) {
                  parsed = {
                    field: "sex",
                    value: digits[0],
                    rawTranscript: finalTranscript,
                    additionalFields: [{ field: "howSexed", value: digits[1] }],
                  };
                }
              }

              pendingFieldRef.current = null;
              // Continuation was successful - set result and skip further processing
              setLastResult(parsed);
              return;
            }
          }
          // If current utterance detected a different field, update pending
          else if (parsed.field && !parsed.value) {
            pendingFieldRef.current = { field: parsed.field, timestamp: now };
          }
        }

        // If this utterance has a field but no value, set it as pending
        // For notes field, also check if value is only whitespace
        const hasValidValue = parsed.value && (parsed.field !== "notes" || parsed.value.trim().length > 0);
        
        if (parsed.field && !hasValidValue) {
          pendingFieldRef.current = { field: parsed.field, timestamp: now };
          // Update transcript to show we're waiting for a value
          setTranscript(`${finalTranscript} (waiting for value...)`);
        } else if (parsed.field && hasValidValue) {
          // Clear pending if we got a complete result
          pendingFieldRef.current = null;
          setLastResult(parsed);
        } else {
          // No field detected and no valid value - don't update result
          setLastResult(parsed);
        }
      }
    };

    recognition.onerror = (event) => {
      // For "no-speech" error, auto-restart if we should keep listening
      if (event.error === "no-speech" && shouldKeepListeningRef.current) {
        // Don't show error, just restart
        try {
          recognition.start();
        } catch {
          // Ignore - might already be starting
        }
        return;
      }
      
      // For other errors, show the error
      if (event.error !== "aborted") {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
      shouldKeepListeningRef.current = false;
    };

    recognition.onend = () => {
      // Auto-restart if we should keep listening (handles browser auto-stop)
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore - might already be starting
          setIsListening(false);
          shouldKeepListeningRef.current = false;
        }
        return;
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setTranscript("");
    setLastResult(null);
    setError(null);
    pendingFieldRef.current = null;
    shouldKeepListeningRef.current = true;

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Recognition might already be started
      console.error("Failed to start recognition:", err);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    shouldKeepListeningRef.current = false;
    
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("Failed to stop recognition:", err);
    }
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    lastResult,
  };
}
