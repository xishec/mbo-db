import { Button, Spinner, Tab, Tabs, useDisclosure } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../../../services/useData";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

enum BirdEventTabType {
  NEW_CAPTURES = "New Captures",
  RE_CAPTURES = "Re-Captures",
}

export default function BirdEvents() {
  const [birdEventTabType, setBirdEventTabType] = useState<BirdEventTabType>(BirdEventTabType.NEW_CAPTURES);
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
      <AddBirdEventModal isOpen={isOpen} onOpenChange={onOpenChange} />

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
          {Object.values(BirdEventTabType).map((value) => (
            <Tab key={value} title={value} />
          ))}
        </Tabs>
        {birdEventTabType === BirdEventTabType.RE_CAPTURES && (
          <Button color="secondary" onPress={onOpen}>
            Add Re-Capture
          </Button>
        )}
      </div>

      {birdEventTabType === BirdEventTabType.NEW_CAPTURES ? <NewCaptures /> : <ReCaptures />}
    </div>
  );
}
