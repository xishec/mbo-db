import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
} from "@heroui/react";
import type { BirdEvent } from "../../../../../types";

interface EditCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  birdEvent: BirdEvent | null;
}

export default function EditCaptureModal({ isOpen, onOpenChange, birdEvent }: EditCaptureModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Edit Capture {birdEvent?.id}
            </ModalHeader>
            <ModalBody>
              <p>Edit capture functionality coming soon...</p>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={onClose}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
