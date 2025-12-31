import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState, useMemo } from "react";
import { useData } from "../../services/useData";
import { BandSize } from "../../types";

interface BandSizeSettingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function BandSizeSettingModal({ isOpen, onOpenChange }: BandSizeSettingModalProps) {
  const { selectedProgram } = useData();
  
  // Initialize from selectedProgram using useMemo
  const initialBandSizeMap = useMemo(() => {
    const initialMap = {} as Record<BandSize, string>;
    Object.values(BandSize).forEach((bandSize) => {
      initialMap[bandSize] = selectedProgram?.BandSizeToBandIdMap?.[bandSize] || "";
    });
    return initialMap;
  }, [selectedProgram]);

  const [bandSizeMap, setBandSizeMap] = useState<Record<BandSize, string>>(initialBandSizeMap);

  const handleInputChange = (bandSize: BandSize, value: string) => {
    setBandSizeMap((prev) => ({
      ...prev,
      [bandSize]: value,
    }));
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log("Saving band size map:", bandSizeMap);
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
              <h2 className="text-2xl font-bold">Band Size Settings</h2>
              <p className="text-sm font-normal">Configure band IDs for each band size</p>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {Object.values(BandSize).map((bandSize) => (
                <div key={bandSize} className="flex items-center gap-4">
                  <div className="w-10 text-sm font-medium">{bandSize}</div>
                  <Input
                    placeholder={`Enter band ID for ${bandSize}`}
                    variant="bordered"
                    value={bandSizeMap[bandSize] || ""}
                    onChange={(e) => handleInputChange(bandSize, e.target.value)}
                    className="flex-1"
                  />
                </div>
              ))}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-0">
              <Button color="danger" variant="light" onPress={onClose} className="flex-1">
                Close
              </Button>
              <Button color="primary" onPress={handleSave} className="flex-1">
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
