import { useState, useEffect } from "react";
import { Button, Chip, Select, SelectItem } from "@heroui/react";
import { CURRENT_ENVIRONMENT, setEnvironment, type Environment } from "../../firebase";
import { useActions } from "../../stores/useAppStore";
import { clearAllIndexedDB, clearEnvironmentCache } from "../../services/indexedDB";
import { logger, type LogEntry, LogLevel } from "../../services/logger";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

function getLogLevelColor(level: LogLevel): "default" | "success" | "warning" | "danger" | "primary" {
  switch (level) {
    case LogLevel.DEBUG: return "default";
    case LogLevel.INFO: return "success";
    case LogLevel.WARN: return "warning";
    case LogLevel.ERROR: return "danger";
    case LogLevel.SYNC: return "primary";
  }
}

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperModal({ isOpen, onClose }: DeveloperModalProps) {
  const { triggerTestMilestone } = useActions();
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());

  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return () => { unsubscribe(); };
  }, []);

  const reversedLogs = [...logs].reverse();

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        onClose,
        size: "3xl",
        scrollBehavior: "inside",
      }}
    >
      <ModalHeaderShell>
        <h2 className="text-xl">Developer Tools</h2>
      </ModalHeaderShell>

      <ModalBodyShell>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <Select
              label="Environment"
              labelPlacement="outside"
              variant="bordered"
              size="sm"
              className="max-w-[150px]"
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
            <div className="flex gap-2 items-end">
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
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold">Logs ({logs.length})</p>
              <Button size="sm" variant="light" onPress={() => logger.clearLogs()}>
                Clear
              </Button>
            </div>
            <div className="flex flex-col gap-0.5 font-mono text-xs">
              {reversedLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 px-2 py-1 rounded hover:bg-default-100">
                  <span className="text-default-400 whitespace-nowrap">{formatLogTime(log.timestamp)}</span>
                  <Chip size="sm" variant="flat" color={getLogLevelColor(log.level)} className="min-w-[50px] text-center">
                    {log.level}
                  </Chip>
                  <span className="text-default-500 whitespace-nowrap">[{log.category}]</span>
                  <span className="text-default-800 break-all">{log.message}</span>
                  {log.data != null && (
                    <span className="text-default-400 break-all">{JSON.stringify(log.data)}</span>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center text-default-500 py-4">No logs</div>
              )}
            </div>
          </div>
        </div>
      </ModalBodyShell>

      <ModalFooterShell>
        <Button color="primary" variant="bordered" onPress={onClose}>
          Close
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
