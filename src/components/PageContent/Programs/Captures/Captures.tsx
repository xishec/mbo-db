import { Button, Chip, Spinner, Tab, Tabs, Tooltip, useDisclosure } from "@heroui/react";
import { MicrophoneIcon } from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import { useData } from "../../../../services/useData";
import { useGlobalVoiceCommands, type VoiceCommand } from "../../../../hooks/useGlobalVoiceCommands";
import AddCaptureModal from "./AddCaptureModal/AddCaptureModal";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

const CAPTURE_TAB_OPTIONS = {
  NEW_CAPTURES: "New Captures",
  RE_CAPTURES: "Re-Captures",
};
type CaptureTabType = keyof typeof CAPTURE_TAB_OPTIONS;

export default function Captures() {
  const [captureTabType, setCaptureTabType] = useState<CaptureTabType>("NEW_CAPTURES");
  const [openedViaVoice, setOpenedViaVoice] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { programData, selectedProgram } = useData();

  // Handler for opening modal via voice
  const handleVoiceOpen = () => {
    setOpenedViaVoice(true);
    onOpen();
  };

  // Handler for modal close - reset voice state
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setOpenedViaVoice(false);
    }
    onOpenChange(open);
  };

  // Voice commands for this page
  const voiceCommands: VoiceCommand[] = useMemo(
    () => [
      {
        triggers: ["add capture", "new capture", "add bird", "new bird", "add band", "new band", "recapture"],
        action: handleVoiceOpen,
        description: "Open the Add Capture modal",
      },
    ],
    [onOpen]
  );

  const {
    isListening,
    isSupported: isVoiceSupported,
    transcript,
    lastCommand,
    toggleListening,
  } = useGlobalVoiceCommands(voiceCommands, !!selectedProgram);

  if (!selectedProgram) {
    return null;
  }

  if (programData.isLoadingProgram) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading program...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <AddCaptureModal isOpen={isOpen} onOpenChange={handleModalOpenChange} initialVoiceMode={openedViaVoice} />

      <div className="w-full flex items-end justify-between gap-4">
        <Tabs
          color="secondary"
          size="md"
          selectedKey={captureTabType}
          onSelectionChange={(key) => setCaptureTabType(key as CaptureTabType)}
          classNames={{
            tabContent: "text-gray-700",
          }}
        >
          {(Object.keys(CAPTURE_TAB_OPTIONS) as CaptureTabType[]).map((key) => (
            <Tab key={key} title={CAPTURE_TAB_OPTIONS[key]} />
          ))}
        </Tabs>

        <div className="flex items-center gap-2">
          {/* Voice command status */}
          {isVoiceSupported && isListening && (
            <div className="flex items-center gap-2 text-sm">
              {transcript && <span className="text-default-500 font-mono max-w-[200px] truncate">"{transcript}"</span>}
              {lastCommand && (
                <Chip color="success" size="sm" variant="flat">
                  ✓ {lastCommand}
                </Chip>
              )}
            </div>
          )}

          {/* Voice command button */}
          {isVoiceSupported && (
            <Tooltip
              content={
                isListening
                  ? 'Listening... Say "add capture" to open modal'
                  : 'Click to enable voice commands (say "add capture", "new bird", etc.)'
              }
            >
              <Button
                isIconOnly
                variant={isListening ? "solid" : "bordered"}
                color={isListening ? "danger" : "default"}
                onPress={toggleListening}
                className={isListening ? "animate-pulse" : ""}
              >
                <MicrophoneIcon className={`w-5 h-5 ${!isListening ? "opacity-50" : ""}`} />
              </Button>
            </Tooltip>
          )}

          <Button color="secondary" onPress={onOpen}>
            Add Capture
          </Button>
        </div>
      </div>

      {captureTabType === "NEW_CAPTURES" ? <NewCaptures /> : <ReCaptures />}
    </div>
  );
}
