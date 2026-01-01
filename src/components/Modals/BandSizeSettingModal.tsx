import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState, useMemo, useRef } from "react";
import { useData } from "../../services/useData";
import { BandSize } from "../../types";

interface BandSizeSettingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function BandSizeSettingModal({ isOpen, onOpenChange }: BandSizeSettingModalProps) {
  const { bandSizeToBandIdMap, updateBandSizeMap } = useData();
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Initialize from bandSizeToBandIdMap - store as single 9-digit string
  const initialBandSizeMap = useMemo(() => {
    const initialMap = {} as Record<BandSize, string>;
    Object.values(BandSize).forEach((bandSize) => {
      initialMap[bandSize] = bandSizeToBandIdMap?.[bandSize] || "";
    });
    return initialMap;
  }, [bandSizeToBandIdMap]);

  const [bandSizeMap, setBandSizeMap] = useState<Record<BandSize, string>>(initialBandSizeMap);

  const handleInputChange = (bandSize: BandSize, field: "bandGroup" | "bandLastTwoDigits", value: string) => {
    // Only allow digits
    const numericValue = value.replace(/\D/g, "");
    const currentBandId = bandSizeMap[bandSize] || "";
    const currentBandGroup = currentBandId.slice(0, 7);
    const currentLastTwo = currentBandId.slice(7, 9);

    let newBandId: string;
    if (field === "bandGroup") {
      newBandId = numericValue + currentLastTwo;
    } else {
      newBandId = currentBandGroup + numericValue;
    }

    setBandSizeMap((prev) => ({
      ...prev,
      [bandSize]: newBandId,
    }));

    // Auto-focus next input when maxLength is reached
    if (field === "bandGroup" && numericValue.length === 7) {
      inputRefs.current.get(`${bandSize}-bandLastTwoDigits`)?.focus();
    }
  };

  const getInputColor = (bandSize: BandSize, field: "bandGroup" | "bandLastTwoDigits"): "warning" | "default" => {
    const bandId = bandSizeMap[bandSize] || "";
    const bandGroup = bandId.slice(0, 7);
    const lastTwo = bandId.slice(7, 9);
    const value = field === "bandGroup" ? bandGroup : lastTwo;
    const minLength = field === "bandGroup" ? 7 : 2;
    const isIncomplete = value.length > 0 && value.length < minLength;
    return isIncomplete ? "warning" : "default";
  };

  const getBorderClass = (color: "warning" | "default") => {
    if (color === "warning") {
      return "!border-warning data-[hover=true]:!border-warning group-data-[focus=true]:!border-warning";
    }
    return "";
  };

  const handleSave = async () => {
    try {
      await updateBandSizeMap(bandSizeMap);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save band size settings:", error);
      alert("Failed to save settings. Please try again.");
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md" scrollBehavior="inside">
      <ModalContent>
        {(handleClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
              <h2 className="text-2xl font-bold">Band Size Settings</h2>
              <p className="text-sm font-normal">Configure band IDs for each band size</p>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {Object.values(BandSize)
                .filter((bandSize) => bandSize !== BandSize.Other)
                .map((bandSize) => {
                  const bandId = bandSizeMap[bandSize] || "";
                  const bandGroup = bandId.slice(0, 7);
                  const lastTwo = bandId.slice(7, 9);
                  const bandGroupColor = getInputColor(bandSize, "bandGroup");
                  const bandLastTwoColor = getInputColor(bandSize, "bandLastTwoDigits");

                  return (
                    <div key={bandSize} className="flex items-center gap-4">
                      <div className="w-10 text-sm font-medium">{`${bandSize} : `}</div>
                      <Input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${bandSize}-bandGroup`, el);
                        }}
                        placeholder="Band Group"
                        variant="bordered"
                        color={bandGroupColor}
                        value={bandGroup}
                        onChange={(e) => handleInputChange(bandSize, "bandGroup", e.target.value)}
                        maxLength={7}
                        className="flex-1"
                        classNames={{
                          input:
                            "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          inputWrapper: getBorderClass(bandGroupColor),
                        }}
                      />
                      <span className="text-sm">-</span>
                      <Input
                        ref={(el) => {
                          if (el) inputRefs.current.set(`${bandSize}-bandLastTwoDigits`, el);
                        }}
                        placeholder="Last 2"
                        variant="bordered"
                        color={bandLastTwoColor}
                        value={lastTwo}
                        onChange={(e) => handleInputChange(bandSize, "bandLastTwoDigits", e.target.value)}
                        maxLength={2}
                        className="w-20"
                        classNames={{
                          input:
                            "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          inputWrapper: getBorderClass(bandLastTwoColor),
                        }}
                      />
                    </div>
                  );
                })}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
              <Button color="danger" variant="bordered" onPress={handleClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
