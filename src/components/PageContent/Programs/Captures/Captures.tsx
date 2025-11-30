import { Button, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { useState } from "react";
import { CAPTURE_TYPE_OPTIONS, type CaptureType } from "../../../../helper/helper";
import { useProgramData } from "../../../../services/useProgramData";
import AddCaptureModal from "./AddCaptureModal";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

export default function Captures() {
  const [captureType, setCaptureType] = useState<CaptureType>("NEW_CAPTURES");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { programData, selectedProgram } = useProgramData();

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
      <AddCaptureModal isOpen={isOpen} onOpenChange={onOpenChange} />

      <div className="w-full flex items-end justify-between gap-4">
        <Tabs
          color="secondary"
          selectedKey={captureType}
          onSelectionChange={(key) => setCaptureType(key as CaptureType)}
        >
          {CAPTURE_TYPE_OPTIONS.map((option) => (
            <Tab key={option.key} title={option.label} />
          ))}
        </Tabs>
        <Button color="secondary" onPress={onOpen}>
          Add Capture
        </Button>
      </div>

      {captureType === "NEW_CAPTURES" ? (
        <NewCaptures />
      ) : (
        <ReCaptures />
      )}
    </div>
  );
}
