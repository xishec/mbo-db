import { useState } from "react";
import { Button, Switch, Select, SelectItem } from "@heroui/react";
import { get, ref, set, update } from "firebase/database";
import { db, CURRENT_ENVIRONMENT, setEnvironment, type Environment } from "../../firebase";
import { useData } from "../../services/useData";
import { clearAllIndexedDB } from "../../services/indexedDB";
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
      // Copy each top-level key, batching large maps with update()
      const BATCH_SIZE = 1000;
      const prodSnap = await get(ref(db, "prod"));
      if (prodSnap.exists()) {
        const prodData = prodSnap.val() as Record<string, unknown>;
        for (const [key, value] of Object.entries(prodData)) {
          if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > BATCH_SIZE) {
            const entries = Object.entries(value as Record<string, unknown>);
            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
              const batch = Object.fromEntries(entries.slice(i, i + BATCH_SIZE));
              await update(ref(db, `alpha/${key}`), batch);
            }
          } else {
            await set(ref(db, `alpha/${key}`), value);
          }
        }
      }

      const prodConstantsSnap = await get(ref(db, "constants/prod"));
      if (prodConstantsSnap.exists()) {
        const constData = prodConstantsSnap.val() as Record<string, unknown>;
        for (const [key, value] of Object.entries(constData)) {
          await set(ref(db, `constants/alpha/${key}`), value);
        }
      }

      await clearAllIndexedDB();
      window.location.reload();
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
          <Select
            label="Environment"
            labelPlacement="outside"
            variant="bordered"
            size="sm"
            selectedKeys={[CURRENT_ENVIRONMENT]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as Environment;
              if (selected && selected !== CURRENT_ENVIRONMENT) {
                clearAllIndexedDB().then(() => setEnvironment(selected));
              }
            }}
          >
            <SelectItem key="alpha">alpha</SelectItem>
            <SelectItem key="prod">prod</SelectItem>
          </Select>
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
