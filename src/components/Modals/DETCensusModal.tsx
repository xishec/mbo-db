import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import type { Census } from "../../types/DET";
import DETSpeciesModal from "./DETSpeciesModal";

interface DETCensusModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  census: Census;
  onSave: (census: Census) => void;
}

export default function DETCensusModal({
  isOpen,
  onOpenChange,
  census: initialCensus,
  onSave,
}: DETCensusModalProps) {
  const [census, setCensus] = useState<Census>(initialCensus);
  const [isSpeciesModalOpen, setIsSpeciesModalOpen] = useState(false);

  useEffect(() => {
    setCensus(initialCensus);
  }, [initialCensus, isOpen]);

  const handleSave = () => {
    onSave(census);
    onOpenChange();
  };

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Edit Census</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Censuser"
                      value={census.censuser || ""}
                      onValueChange={(val) => setCensus({ ...census, censuser: val })}
                      variant="bordered"
                    />
                    <Input
                      label="Start"
                      type="time"
                      value={census.start || ""}
                      onValueChange={(val) => setCensus({ ...census, start: val })}
                      variant="bordered"
                    />
                    <Input
                      label="End"
                      type="time"
                      value={census.end || ""}
                      onValueChange={(val) => setCensus({ ...census, end: val })}
                      variant="bordered"
                    />
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-semibold">Census Species Count</p>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        onPress={() => setIsSpeciesModalOpen(true)}
                      >
                        Edit Species
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(census.speciesCount).map(([code, count]) => (
                        <div key={code} className="border rounded px-2 py-1">
                          <span className="font-medium">{code}: {count}</span>
                        </div>
                      ))}
                      {Object.keys(census.speciesCount).length === 0 && (
                        <p className="text-sm text-gray-500">No species added</p>
                      )}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="flat" onPress={onClose}>
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

      <DETSpeciesModal
        isOpen={isSpeciesModalOpen}
        onOpenChange={setIsSpeciesModalOpen}
        speciesCount={census.speciesCount}
        onSave={(speciesCount) => setCensus({ ...census, speciesCount })}
        title="Edit Census Species Count"
      />
    </>
  );
}
