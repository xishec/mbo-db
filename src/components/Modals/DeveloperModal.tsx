import { useState, useEffect, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Card,
  CardBody,
  Accordion,
  AccordionItem,
  Switch,
} from "@heroui/react";
import { logger, LogLevel, type LogEntry } from "../../services/logger";
import { useData } from "../../services/useData";

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperModal({ isOpen, onClose }: DeveloperModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set(["all"]));
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set(["all"]));
  const { forceOffline, setForceOffline } = useData();

  // Subscribe to log updates
  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return () => {
      unsubscribe();
    };
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(logs.map((log) => log.category));
    return ["all", ...Array.from(cats).sort()];
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      const selectedLevel = Array.from(levelFilter)[0];
      if (selectedLevel !== "all" && log.level !== selectedLevel) {
        return false;
      }

      // Category filter
      const selectedCategory = Array.from(categoryFilter)[0];
      if (selectedCategory !== "all" && log.category !== selectedCategory) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.category.toLowerCase().includes(query) ||
          JSON.stringify(log.data).toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [logs, levelFilter, categoryFilter, searchQuery]);

  const handleClearLogs = () => {
    if (confirm("Are you sure you want to clear all logs?")) {
      logger.clearLogs();
    }
  };

  const handleExportLogs = () => {
    const data = logger.exportLogs();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mbo-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return "default";
      case LogLevel.INFO:
        return "primary";
      case LogLevel.WARN:
        return "warning";
      case LogLevel.ERROR:
        return "danger";
      case LogLevel.SYNC:
        return "secondary";
      default:
        return "default";
    }
  };

  const stats = logger.getStats();

  return (
    <Modal isDismissable isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Developer Mode</h2>
              <p className="text-sm text-default-500">
                {filteredLogs.length} of {logs.length} logs
              </p>
            </div>
            <div className="flex gap-4 items-center">
              <Switch isSelected={forceOffline} onValueChange={setForceOffline}>
                Force Offline
              </Switch>
              <div className="flex gap-2">
                {Object.entries(stats.byLevel).map(([level, count]) => (
                  <Chip key={level} color={getLevelColor(level as LogLevel)} variant="flat">
                    {level}: {count}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="flex-1"
              size="sm"
            />
            <Select
              label="Level"
              size="sm"
              className="w-40"
              selectedKeys={levelFilter}
              onSelectionChange={(keys) => setLevelFilter(keys as Set<string>)}
            >
              <SelectItem key="all">All Levels</SelectItem>
              <SelectItem key={LogLevel.DEBUG}>{LogLevel.DEBUG}</SelectItem>
              <SelectItem key={LogLevel.INFO}>{LogLevel.INFO}</SelectItem>
              <SelectItem key={LogLevel.WARN}>{LogLevel.WARN}</SelectItem>
              <SelectItem key={LogLevel.ERROR}>{LogLevel.ERROR}</SelectItem>
              <SelectItem key={LogLevel.SYNC}>{LogLevel.SYNC}</SelectItem>
            </Select>
            <Select
              label="Category"
              size="sm"
              className="w-48"
              selectedKeys={categoryFilter}
              onSelectionChange={(keys) => setCategoryFilter(keys as Set<string>)}
            >
              {categories.map((cat) => (
                <SelectItem key={cat}>{cat === "all" ? "All Categories" : cat}</SelectItem>
              ))}
            </Select>
          </div>

          <Tabs aria-label="Log views" className="mb-4">
            <Tab key="logs" title={`Logs (${filteredLogs.length})`}>
              <div className="flex flex-col gap-2 mt-2">
                {filteredLogs.length === 0 ? (
                  <Card>
                    <CardBody>
                      <p className="text-center text-default-500">No logs to display</p>
                    </CardBody>
                  </Card>
                ) : (
                  filteredLogs
                    .slice()
                    .reverse()
                    .map((log) => (
                      <Card key={log.id}>
                        <CardBody className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Chip color={getLevelColor(log.level)} variant="flat">
                                  {log.level}
                                </Chip>
                                <Chip variant="flat">{log.category}</Chip>
                                <span className="text-xs text-default-400">
                                  {new Date(log.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm font-medium">{log.message}</p>
                              {log.data !== undefined && log.data !== null ? (
                                <Accordion className="mt-2" variant="light">
                                  <AccordionItem
                                    key="data"
                                    aria-label="View data"
                                    title="View data"
                                    classNames={{
                                      title: "text-xs text-default-500",
                                    }}
                                  >
                                    <pre className="text-xs bg-default-100 p-2 rounded overflow-x-auto">
                                      {typeof log.data === "string" ? log.data : JSON.stringify(log.data, null, 2)}
                                    </pre>
                                  </AccordionItem>
                                </Accordion>
                              ) : null}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))
                )}
              </div>
            </Tab>

            <Tab key="stats" title="Statistics">
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Card>
                  <CardBody>
                    <h3 className="font-semibold mb-2">By Level</h3>
                    <div className="space-y-1">
                      {Object.entries(stats.byLevel).map(([level, count]) => (
                        <div key={level} className="flex justify-between text-sm">
                          <span>{level}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <h3 className="font-semibold mb-2">By Category</h3>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {Object.entries(stats.byCategory)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => (
                          <div key={category} className="flex justify-between text-sm">
                            <span className="truncate">{category}</span>
                            <span className="font-medium ml-2">{count}</span>
                          </div>
                        ))}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>

        <ModalFooter className="gap-4 p-8 pt-4">
          <Button color="danger" variant="light" onPress={handleClearLogs}>
            Clear Logs
          </Button>
          <Button color="primary" variant="light" onPress={handleExportLogs}>
            Export JSON
          </Button>
          <Button color="primary" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
