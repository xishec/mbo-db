import { Button, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../../../services/useData";
import AddCaptureModal from "../../../Modals/AddCaptureModal";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

const BIRD_EVENT_TAB_OPTIONS = {
  NEW_CAPTURES: "New Captures",
  RE_CAPTURES: "Re-Captures",
} as const;

type BirdEventTabType = keyof typeof BIRD_EVENT_TAB_OPTIONS;

export default function BirdEvents() {
  const [birdEventTabType, setBirdEventTabType] = useState<BirdEventTabType>("NEW_CAPTURES");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { selectedProgram, isLoading } = useData();

  if (!selectedProgram) {
    return null;
  }

  if (isLoading) {
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
          selectedKey={birdEventTabType}
          onSelectionChange={(key) => setBirdEventTabType(key as BirdEventTabType)}
          classNames={{
            tabContent: "text-gray-700",
          }}
        >
          {(Object.keys(BIRD_EVENT_TAB_OPTIONS) as BirdEventTabType[]).map((key) => (
            <Tab key={key} title={BIRD_EVENT_TAB_OPTIONS[key]} />
          ))}
        </Tabs>
        <Button color="secondary" onPress={onOpen}>
          {birdEventTabType === "NEW_CAPTURES" ? "Add Capture" : "Add Re-Capture"}
        </Button>
      </div>

      {birdEventTabType === "NEW_CAPTURES" ? <NewCaptures /> : <ReCaptures />}
    </div>
  );
}
