import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

interface BandSizeSettingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function BandSizeSettingModal({ isOpen, onOpenChange }: BandSizeSettingModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Band Size Settings</ModalHeader>
            <ModalBody>
              <p>Configure band size settings here.</p>
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
