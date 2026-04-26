import { Button, Spinner, Tab, Tabs, useDisclosure, ButtonGroup, Tooltip } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../../../services/useData";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import { BandSize } from "../../../../types";
import NewCaptures from "./NewCaptures";
import ReCaptures from "./ReCaptures";

enum BirdEventTabType {
  NEW_CAPTURES = "New Captures",
  RE_CAPTURES = "Re-Captures",
}

export default function BirdEvents() {
  const [birdEventTabType, setBirdEventTabType] = useState<BirdEventTabType>(BirdEventTabType.NEW_CAPTURES);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { selectedProgram, isLoading, bandSizeToBandIdMap, isLoggedIn } = useData();
  const [selectedBandSize, setSelectedBandSize] = useState<BandSize>(BandSize.Other);
  const [activeBandGroupId, setActiveBandGroupId] = useState<string | null>(null);

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

  const addBirdEvent = () => (
    <>
      {birdEventTabType === BirdEventTabType.NEW_CAPTURES ? (
        <ButtonGroup color="secondary" variant="flat">
          {Object.values(BandSize).map((bandSize) => {
            const nextBandId = bandSizeToBandIdMap?.[bandSize];
            const isActive =
              !!activeBandGroupId && nextBandId?.slice(0, 7) === activeBandGroupId;
            return (
              <Tooltip
                key={bandSize}
                closeDelay={50}
                color={"default"}
                placement="bottom"
                content={nextBandId ? `${nextBandId.slice(0, 7)}-${nextBandId.slice(-2)}` : "Not set"}
                isDisabled={bandSize === BandSize.Other}
              >
                <Button
                  onMouseEnter={() => {
                    if (nextBandId && nextBandId.length >= 7) setActiveBandGroupId(nextBandId.slice(0, 7));
                  }}
                  onPress={() => {
                    setSelectedBandSize(bandSize);
                    onOpen();
                  }}
                  className={`text-gray-700 ${isActive ? "!bg-secondary-400" : ""}`}
                >
                  {bandSize}
                </Button>
              </Tooltip>
            );
          })}
        </ButtonGroup>
      ) : (
        <Button
          color="secondary"
          onPress={() => {
            setSelectedBandSize(BandSize.Other);
            onOpen();
          }}
        >
          Add Re-Capture
        </Button>
      )}
    </>
  );

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <AddBirdEventModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        bandSize={selectedBandSize}
        isNewCapture={birdEventTabType === BirdEventTabType.NEW_CAPTURES}
      />

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

        {isLoggedIn && addBirdEvent()}
      </div>

      {birdEventTabType === BirdEventTabType.NEW_CAPTURES ? <NewCaptures activeBandGroupId={activeBandGroupId} /> : <ReCaptures />}
    </div>
  );
}
