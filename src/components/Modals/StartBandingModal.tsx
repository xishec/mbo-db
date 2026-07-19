import { Button, ModalBody, ModalFooter, Switch } from "@heroui/react";
import { useState } from "react";
import ModalShell from "./ModalShell";
import StartBandingEntry from "./StartBandingEntry";

interface StartBandingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function StartBandingModal({ isOpen, onOpenChange }: StartBandingModalProps) {
  const [isDoubleBanding, setIsDoubleBanding] = useState(false);

  return (
    <ModalShell
      modalProps={{
        isOpen,
        onOpenChange,
        size: "full",
        isDismissable: false,
        isKeyboardDismissDisabled: true,
        scrollBehavior: "inside",
      }}
      contentProps={{
        className: "h-dvh max-h-dvh rounded-none",
      }}
    >
      {(onClose) => (
        <>
          <ModalBody className="items-center justify-center gap-4 px-10 pb-10 pt-10">
            <div className="flex w-full max-w-[2400px] flex-col gap-5">
              <StartBandingEntry entryId="primary" isDoubleBanding={isDoubleBanding} />
              {isDoubleBanding && <StartBandingEntry entryId="secondary" isDoubleBanding={isDoubleBanding} />}
            </div>
          </ModalBody>
          <ModalFooter className="justify-between gap-4 p-8 pt-0">
            <Switch isSelected={isDoubleBanding} onValueChange={setIsDoubleBanding}>
              Double banding
            </Switch>
            <Button color="primary" variant="bordered" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
}
