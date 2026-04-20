import { useState, useEffect, useCallback } from "react";
import { Button, Tab, Tabs } from "@heroui/react";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { useData } from "../../services/useData";
import { TABLE_COLUMNS, RE_CAPTURE_COLUMN_ORDER } from "../PageContent/Programs/Captures/helpers";
import type { AppSettings } from "../../types";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalCancelButtonProps, modalPrimaryButtonProps } from "./modalDefaults";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EDITABLE_KEYS = new Set<string>(TABLE_COLUMNS.filter((c) => c.key !== "actions" && c.key !== "updatedAt").map((c) => c.key));
const DEFAULT_CAPTURE_ORDER = TABLE_COLUMNS.map((c) => c.key).filter((k) => EDITABLE_KEYS.has(k));
const DEFAULT_RECAPTURE_ORDER = RE_CAPTURE_COLUMN_ORDER.filter((k) => EDITABLE_KEYS.has(k));
const COLUMN_LABELS: Record<string, string> = {};
for (const col of TABLE_COLUMNS) COLUMN_LABELS[col.key] = col.label;

function ColumnOrderList({
  order,
  onChange,
  isDisabled,
}: {
  order: string[];
  onChange: (order: string[]) => void;
  isDisabled: boolean;
}) {
  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const newOrder = [...order];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return;
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      onChange(newOrder);
    },
    [order, onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      {order.map((key, index) => (
        <div
          key={key}
          className="flex items-center gap-2 px-3 py-2 rounded-medium border border-default-200 bg-default-50"
        >
          <span className="flex-1 text-sm font-medium">{COLUMN_LABELS[key] ?? key}</span>
          <div className="flex gap-1">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              isDisabled={isDisabled || index === 0}
              onPress={() => move(index, -1)}
            >
              <ChevronUpIcon className="w-4 h-4" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              isDisabled={isDisabled || index === order.length - 1}
              onPress={() => move(index, 1)}
            >
              <ChevronDownIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { appSettings, updateAppSettings, isOnline } = useData();

  const [captureOrder, setCaptureOrder] = useState<string[]>(DEFAULT_CAPTURE_ORDER);
  const [recaptureOrder, setRecaptureOrder] = useState<string[]>(DEFAULT_RECAPTURE_ORDER);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCaptureOrder(appSettings.captureColumnOrder ?? DEFAULT_CAPTURE_ORDER);
      setRecaptureOrder(appSettings.recaptureColumnOrder ?? DEFAULT_RECAPTURE_ORDER);
    }
  }, [isOpen, appSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings: AppSettings = {
        ...appSettings,
        captureColumnOrder: captureOrder,
        recaptureColumnOrder: recaptureOrder,
      };
      await updateAppSettings(newSettings);
      onClose();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (tab: "capture" | "recapture") => {
    if (tab === "capture") setCaptureOrder(DEFAULT_CAPTURE_ORDER);
    else setRecaptureOrder(DEFAULT_RECAPTURE_ORDER);
  };

  return (
    <ModalShell
      modalProps={{
        isOpen,
        onClose,
        size: "md",
        scrollBehavior: "inside",
      }}
    >
      {(onModalClose) => (
        <>
          <ModalHeaderShell>
            <h2 className="text-xl font-bold">Settings</h2>
            <p className="text-sm font-normal text-default-600">Configure column order for data entry</p>
          </ModalHeaderShell>
          <ModalBodyShell>
            <Tabs aria-label="Column order settings" variant="underlined">
              <Tab key="capture" title="Capture">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-default-600">Column order for new captures</p>
                  <Button size="sm" variant="light" onPress={() => handleReset("capture")}>
                    Reset
                  </Button>
                </div>
                <ColumnOrderList order={captureOrder} onChange={setCaptureOrder} isDisabled={!isOnline} />
              </Tab>
              <Tab key="recapture" title="Recapture">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-default-600">Column order for recaptures</p>
                  <Button size="sm" variant="light" onPress={() => handleReset("recapture")}>
                    Reset
                  </Button>
                </div>
                <ColumnOrderList order={recaptureOrder} onChange={setRecaptureOrder} isDisabled={!isOnline} />
              </Tab>
            </Tabs>
          </ModalBodyShell>
          <ModalFooterShell>
            <Button {...modalCancelButtonProps} onPress={onModalClose}>
              Cancel
            </Button>
            <Button {...modalPrimaryButtonProps} onPress={handleSave} isLoading={isSaving} isDisabled={!isOnline}>
              {isOnline ? "Save" : "Offline"}
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
