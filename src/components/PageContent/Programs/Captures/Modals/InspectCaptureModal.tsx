import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
} from "@heroui/react";
import type { BirdEvent } from "../../../../../types";

interface InspectCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  birdEvent: BirdEvent | null;
}

export default function InspectCaptureModal({ isOpen, onOpenChange, birdEvent }: InspectCaptureModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Inspect Capture {birdEvent?.id}
            </ModalHeader>
            <ModalBody>
              <p>Inspect capture functionality coming soon...</p>
              {birdEvent && (
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Band:</strong> {birdEvent.band?.displayBandGroupId}-{birdEvent.band?.last2digits}</div>
                  <div><strong>Species:</strong> {birdEvent.species}</div>
                  <div><strong>Date:</strong> {birdEvent.date}</div>
                  <div><strong>Time:</strong> {birdEvent.time}</div>
                  <div><strong>Sex:</strong> {birdEvent.sex}</div>
                  <div><strong>Age:</strong> {birdEvent.age}</div>
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
