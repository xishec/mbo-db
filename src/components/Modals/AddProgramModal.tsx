import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../services/useData";

interface AddProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddProgramModal({ isOpen, onOpenChange }: AddProgramModalProps) {
  const { addProgram } = useData();
  const [displayName, setDisplayName] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (displayName.trim() && year.trim()) {
      setIsLoading(true);
      try {
        // Auto-generate programId from timestamp
        const programId = `${displayName.trim()}-${Date.now().toString()}`;
        await addProgram(programId, displayName.trim(), year.trim());
        setDisplayName("");
        setYear(new Date().getFullYear().toString());
        onOpenChange(false);
      } catch (err) {
        console.error("Failed to add program:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
          <h2 className="text-2xl font-bold">Add New Program</h2>
          <p className="text-sm font-normal">Enter a display name and year for the new program</p>
        </ModalHeader>
        <ModalBody className="gap-4 px-8 py-4">
          <Input
            label="Year"
            placeholder="Enter year"
            variant="bordered"
            value={year}
            labelPlacement="outside"
            onChange={(e) => setYear(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && displayName.trim() && year.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            type="number"
          />
          <Input
            label="Display Name"
            placeholder="Enter display name (e.g., MBO Fall Migration)"
            variant="bordered"
            value={displayName}
            labelPlacement="outside"
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && displayName.trim() && year.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            autoFocus
          />
        </ModalBody>
        <ModalFooter className="gap-4 p-8 pt-4">
          <Button
            color="danger"
            variant="bordered"
            onPress={() => onOpenChange(false)}
            className="flex-1"
            isDisabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={!displayName.trim() || !year.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Add Program
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
