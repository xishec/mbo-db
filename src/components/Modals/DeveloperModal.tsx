import { Button, Select, SelectItem } from "@heroui/react";
import { CURRENT_ENVIRONMENT, setEnvironment, type Environment } from "../../firebase";
import { useData } from "../../services/useData";
import { clearAllIndexedDB, clearEnvironmentCache } from "../../services/indexedDB";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalPrimaryButtonProps } from "./modalDefaults";

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperModal({ isOpen, onClose }: DeveloperModalProps) {
  const { triggerTestMilestone } = useData();

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
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
                setEnvironment(selected);
              }
            }}
          >
            <SelectItem key="alpha">alpha</SelectItem>
            <SelectItem key="prod">prod</SelectItem>
          </Select>
          <Button size="sm" variant="flat" color="warning" onPress={triggerTestMilestone}>
            Test Milestone
          </Button>
          <Button size="sm" variant="flat" color="warning" onPress={() => clearEnvironmentCache(CURRENT_ENVIRONMENT).then(() => window.location.reload())}>
            Clear Cache ({CURRENT_ENVIRONMENT})
          </Button>
          <Button size="sm" variant="flat" color="danger" onPress={() => clearAllIndexedDB().then(() => window.location.reload())}>
            Clear All IndexedDB
          </Button>
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
