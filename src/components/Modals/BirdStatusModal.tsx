import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { useState } from "react";
import { BIRD_STATUS_CODES } from "../../types/birdStatus";

interface BirdStatusModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

export default function BirdStatusModal({
  isOpen,
  onOpenChange,
  currentStatus,
  onStatusChange,
}: BirdStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const handleSave = () => {
    onStatusChange(selectedStatus);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-row items-center justify-between p-8 pb-0 font-normal">
              <div className="flex flex-row items-center gap-1 font-bold">Select Bird Status</div>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              <RadioGroup
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                classNames={{
                  wrapper: "gap-3",
                }}
              >
                {Object.values(BIRD_STATUS_CODES).map((status) => (
                  <Radio
                    key={status.code}
                    value={status.code}
                    description={status.description}
                    classNames={{
                      base: "inline-flex m-0 bg-content1 hover:bg-content2 items-center justify-between flex-row-reverse max-w-full cursor-pointer rounded-lg gap-4 p-4 border-2 border-transparent data-[selected=true]:border-primary",
                      label: "font-medium",
                    }}
                  >
                    {status.code}
                  </Radio>
                ))}
              </RadioGroup>
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
              <Button color="danger" variant="bordered" onPress={handleCancel}>
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
