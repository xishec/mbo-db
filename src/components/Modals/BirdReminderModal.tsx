import { Button } from "@heroui/react";
import { BellAlertIcon } from "@heroicons/react/24/outline";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

interface BirdReminderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandId: string;
  notes: string[];
}

export default function BirdReminderModal({ isOpen, onOpenChange, bandId, notes }: BirdReminderModalProps) {
  return (
    <ModalShell modalProps={{ isOpen, onOpenChange, isDismissable: false, size: "2xl" }}>
      {(onClose) => (
        <>
          <ModalHeaderShell>
            <div className="flex items-center gap-2">
              <BellAlertIcon className="h-6 w-6 text-warning" />
              Reminder for band {bandId}
            </div>
          </ModalHeaderShell>
          <ModalBodyShell>
            <p className="font-medium">Please check this bird's past notes before continuing.</p>
            <div className="flex flex-col gap-3">
              {notes.map((note, index) => (
                <div key={`${bandId}-${index}`} className="rounded-medium border border-warning-200 bg-warning-50 p-3">
                  {note || "A reminder was set without a note. Review the capture history."}
                </div>
              ))}
            </div>
          </ModalBodyShell>
          <ModalFooterShell>
            <Button color="primary" onPress={onClose}>
              Close
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
