import { Button, ModalBody, ModalFooter, Switch } from "@heroui/react";
import { useState } from "react";
import { useAppStore } from "../../stores/useAppStore";
import ModalShell from "./ModalShell";
import StartBandingEntry from "./StartBandingEntry";

interface StartBandingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function StartBandingModal({ isOpen, onOpenChange }: StartBandingModalProps) {
  const [isDoubleBanding, setIsDoubleBanding] = useState(false);
  const isSaving = useAppStore((s) => s.isSaving);

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
          <ModalBody className="items-center gap-4 px-10 pb-10 pt-10">
            <div
              className={`grid h-full min-h-0 w-full gap-5 ${
                isDoubleBanding ? "max-w-[2400px] grid-cols-1 2xl:grid-cols-2" : "max-w-[1200px]"
              }`}
            >
              <StartBandingEntry entryId="primary" isDoubleBanding={isDoubleBanding} isOpen={isOpen} />
              {isDoubleBanding && (
                <StartBandingEntry entryId="secondary" isDoubleBanding={isDoubleBanding} isOpen={isOpen} />
              )}
            </div>
          </ModalBody>
          <ModalFooter className="justify-between gap-4 p-8 pt-0">
            <Switch isSelected={isDoubleBanding} onValueChange={setIsDoubleBanding} isDisabled={isSaving}>
              Double banding
            </Switch>
            <Button color="primary" variant="bordered" onPress={onClose} isDisabled={isSaving}>
              Close
            </Button>
          </ModalFooter>
        </>
      )}
    </ModalShell>
  );
}
