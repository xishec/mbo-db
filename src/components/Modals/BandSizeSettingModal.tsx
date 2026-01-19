import { Button, Input } from "@heroui/react";
import { useState, useMemo, useRef } from "react";
import { useData } from "../../services/useData";
import { BandSize } from "../../types";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import {
        modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

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
    const currentInternalBandGroup = currentBandId.slice(0, 7); // Internal storage format
    const currentLastTwo = currentBandId.slice(7, 9);

    let newBandId: string;
    if (field === "bandGroup") {
      newBandId = numericValue + currentLastTwo;
    } else {
      newBandId = currentInternalBandGroup + numericValue;
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
    <ModalShell
      modalProps={{
        isDismissable: true,
        isOpen,
        onOpenChange,
        size: "md",
        scrollBehavior: "inside",
      }}
    >
      {(handleClose) => (
        <>
            <ModalHeaderShell>
              <h2 className="text-2xl font-bold">Band Size Settings</h2>
              <p className="text-sm font-normal">Configure band IDs for each band size</p>
            </ModalHeaderShell>
            <ModalBodyShell>
              {Object.values(BandSize)
                .filter((bandSize) => bandSize !== BandSize.Other)
                .map((bandSize) => {
                  const bandId = bandSizeMap[bandSize] || "";
                  const bandGroup = bandId ? bandId.slice(0, 7) : "";
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
                        {...modalInputProps}
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
                        {...modalInputProps}
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
            </ModalBodyShell>
            <ModalFooterShell>
              <Button {...modalCancelButtonProps} onPress={handleClose}>
                Cancel
              </Button>
              <Button {...modalPrimaryButtonProps} onPress={handleSave}>
                Save
              </Button>
            </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
