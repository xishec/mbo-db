import { useState, useEffect, useCallback } from "react";
import { Button, Tab, Tabs } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
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

// Columns that must stay together in fixed relative order
const COLUMN_GROUPS: string[][] = [
  ["bandGroup", "bandLastTwoDigits", "species"],
  ["bander", "scribe"],
  ["date", "time"],
  ["wing", "age", "howAged", "sex", "howSexed", "fat", "weight"],
];

const KEY_TO_GROUP = new Map<string, string[]>();
for (const group of COLUMN_GROUPS) {
  for (const key of group) KEY_TO_GROUP.set(key, group);
}

// Collapse an order array into "blocks" — grouped keys become one block, ungrouped keys are solo blocks
function toBlocks(order: string[]): string[][] {
  const blocks: string[][] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (seen.has(key)) continue;
    const group = KEY_TO_GROUP.get(key);
    if (group) {
      blocks.push(group);
      for (const k of group) seen.add(k);
    } else {
      blocks.push([key]);
      seen.add(key);
    }
  }
  return blocks;
}

function fromBlocks(blocks: string[][]): string[] {
  return blocks.flat();
}

function ColumnOrderList({
  order,
  onChange,
  isDisabled,
}: {
  order: string[];
  onChange: (order: string[]) => void;
  isDisabled: boolean;
}) {
  const blocks = toBlocks(order);

  const moveBlock = useCallback(
    (blockIndex: number, direction: -1 | 1) => {
      const newBlocks = [...blocks.map((b) => [...b])];
      const targetIndex = blockIndex + direction;
      if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
      [newBlocks[blockIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[blockIndex]];
      onChange(fromBlocks(newBlocks));
    },
    [blocks, onChange]
  );

  return (
    <div className="flex gap-1 overflow-x-auto py-4">
      {blocks.map((block, blockIndex) => (
        <div
          key={block.join("-")}
          className="flex items-center gap-0.5 pl-1 pr-1 py-1 rounded-medium border border-default-200 bg-default-50"
        >
          <Button
            isIconOnly
            size="sm"
            variant="light"
            isDisabled={isDisabled || blockIndex === 0}
            onPress={() => moveBlock(blockIndex, -1)}
            className="min-w-6 w-6 h-6"
          >
            <ChevronLeftIcon className="w-3 h-3" />
          </Button>
          <span className="text-sm font-medium whitespace-nowrap">
            {block.map((key) => COLUMN_LABELS[key] ?? key).join(" - ")}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            isDisabled={isDisabled || blockIndex === blocks.length - 1}
            onPress={() => moveBlock(blockIndex, 1)}
            className="min-w-6 w-6 h-6"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </Button>
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
        className: "!max-w-[1200px]",
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
                <p className="text-sm text-default-600 mb-3">Column order for new captures</p>
                <ColumnOrderList order={captureOrder} onChange={setCaptureOrder} isDisabled={!isOnline} />
              </Tab>
              <Tab key="recapture" title="Recapture">
                <p className="text-sm text-default-600 mb-3">Column order for recaptures</p>
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
