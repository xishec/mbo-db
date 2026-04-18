import { useState } from "react";
import { Button, Switch } from "@heroui/react";
import { get, ref, set } from "firebase/database";
import { db, CURRENT_ENVIRONMENT } from "../../firebase";
import { useData } from "../../services/useData";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalPrimaryButtonProps } from "./modalDefaults";

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperModal({ isOpen, onClose }: DeveloperModalProps) {
  const { forceOffline, setForceOffline, triggerTestMilestone } = useData();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyFromProd = async () => {
    if (!confirm("This will overwrite ALL alpha data and constants with prod. Are you sure?")) return;

    setIsCopying(true);
    try {
      // Copy each top-level key separately to avoid "Write too large" error
      const prodSnap = await get(ref(db, "prod"));
      if (prodSnap.exists()) {
        const prodData = prodSnap.val() as Record<string, unknown>;
        for (const [key, value] of Object.entries(prodData)) {
          await set(ref(db, `alpha/${key}`), value);
        }
      }

      const prodConstantsSnap = await get(ref(db, "constants/prod"));
      if (prodConstantsSnap.exists()) {
        const constData = prodConstantsSnap.val() as Record<string, unknown>;
        for (const [key, value] of Object.entries(constData)) {
          await set(ref(db, `constants/alpha/${key}`), value);
        }
      }

      alert("Done! Reload the app to see changes.");
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : err));
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <ModalShell
      modalProps={{
        isDismissable: true,
        isOpen,
        onClose,
        size: "sm",
      }}
    >
      <ModalHeaderShell>
        <h2 className="text-xl">Developer Tools</h2>
      </ModalHeaderShell>

      <ModalBodyShell>
        <div className="flex flex-col gap-4">
          <Switch isSelected={forceOffline} onValueChange={setForceOffline}>
            Force Offline
          </Switch>
          <Button size="sm" variant="flat" color="warning" onPress={triggerTestMilestone}>
            Test Milestone
          </Button>
          {CURRENT_ENVIRONMENT === "alpha" && (
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onPress={handleCopyFromProd}
              isLoading={isCopying}
            >
              Copy prod → alpha
            </Button>
          )}
        </div>
      </ModalBodyShell>

      <ModalFooterShell>
        <Button {...modalPrimaryButtonProps} onPress={onClose}>
          Close
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
