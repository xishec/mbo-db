import { Button, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../../../services/useData";
import AddCaptureModal from "./AddCaptureModal";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

const CAPTURE_TAB_OPTIONS = {
  NEW_CAPTURES: "New Captures",
  RE_CAPTURES: "Re-Captures",
};
type CaptureTabType = keyof typeof CAPTURE_TAB_OPTIONS;

export default function Captures() {
  const [captureTabType, setCaptureTabType] = useState<CaptureTabType>("NEW_CAPTURES");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { programData, selectedProgram } = useData();

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
        <Button color="secondary" onPress={onOpen}>
          Add Capture
        </Button>
      </div>

      {captureTabType === "NEW_CAPTURES" ? <NewCaptures /> : <ReCaptures />}
    </div>
  );
}
