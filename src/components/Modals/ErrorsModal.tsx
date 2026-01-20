import { useEffect, useMemo, useState } from "react";
import { Button, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useData } from "../../services/useData";
import { type BirdEventError, findBirdEventErrors } from "../../types/birdEventErrors";
import CaptureHistoryModal from "./CaptureHistoryModal";
import ExportButton from "../Helper/ExportButton";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const {
    birdEventsMap,
    bandIdToBirdEventIdsMap,
    magicTable,
    dismissedConflictsMap,
    dismissConflict,
    resetDismissedConflicts,
    isLoggedIn,
    isOnline,
  } = useData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);
  const [errorsState, setErrorsState] = useState<{ errors: BirdEventError[]; dismissedCount: number }>({
    errors: [],
    dismissedCount: 0,
  });
  const [isComputing, setIsComputing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const computeErrors = () => {
      const allErrors = findBirdEventErrors(bandIdToBirdEventIdsMap, birdEventsMap, magicTable);
      const activeErrors: BirdEventError[] = [];
      let dismissedCount = 0;

      for (const error of allErrors) {
        if (error.severity !== "danger") continue;
        if (dismissedConflictsMap[error.id]) {
          dismissedCount += 1;
          continue;
        }
        activeErrors.push(error);
      }

      // Sort by updatedAt (most recent first)
      const sortedErrors = activeErrors.sort((a, b) => {
        const aTime = parseInt(a.birdEvent.updatedAt || "0", 10);
        const bTime = parseInt(b.birdEvent.updatedAt || "0", 10);
        return bTime - aTime; // Descending order (newest first)
      });

      if (!cancelled) {
        setErrorsState({ errors: sortedErrors, dismissedCount });
        setIsComputing(false);
      }
    };

    const schedule = () => {
      if (isOpen) {
        const timeoutId = setTimeout(computeErrors, 0);
        return () => clearTimeout(timeoutId);
      }

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const idleId = (window as typeof window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }).requestIdleCallback?.(computeErrors, { timeout: 1000 });
        return () => {
          if (idleId !== undefined) {
            (window as typeof window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleId);
          }
        };
      }

      const timeoutId = setTimeout(computeErrors, 0);
      return () => clearTimeout(timeoutId);
    };

    if (isOpen) {
      setIsComputing(true);
    }
    const cleanup = schedule();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isOpen, bandIdToBirdEventIdsMap, birdEventsMap, magicTable, dismissedConflictsMap]);

  const { errors, dismissedCount } = errorsState;

  const exportBirdEvents = useMemo(() => errors.map((error) => error.birdEvent), [errors]);
  const exportComments = useMemo(
    () =>
      errors.reduce((acc, error) => {
        acc[error.birdEvent.id] = error.reason;
        return acc;
      }, {} as Record<string, string>),
    [errors]
  );

  const columns = useMemo(
    () => [
      { key: "band", label: "Band", className: "w-[100px]" },
      { key: "datetime", label: "Date/Time", className: "w-[200px]" },
      { key: "species", label: "Species", className: "w-[100px]" },
      { key: "reason", label: "Reason", className: "w-auto" },
      { key: "actions", label: "", className: "w-[60px]" },
    ],
    []
  );

  const handleErrorClick = (error: { birdEvent: { id: string; band?: { id: string } }; reason: string }) => {
    if (error.birdEvent.band) {
      setSelectedBandId(error.birdEvent.band.id);
      setSelectedBirdEventId(error.birdEvent.id);
      setIsCaptureHistoryModalOpen(true);
    }
  };

  const handleDismissError = async (errorId: string) => {
    try {
      await dismissConflict(errorId);
    } catch (error) {
      console.error("Failed to dismiss error:", error);
    }
  };

  const handleResetDismissedErrors = async () => {
    try {
      await resetDismissedConflicts();
    } catch (error) {
      console.error("Failed to reset dismissed errors:", error);
    }
  };

  return (
    <>
      <ModalShell
        modalProps={{
          isDismissable: true,
          isOpen,
          onClose,
          className: "!max-w-[calc(100%-8rem)]",
          scrollBehavior: "inside",
        }}
      >
        <ModalHeaderShell>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl">Data Errors</h2>
              <p className="text-sm text-default-900 font-light">
                {errors.length} severe errors found
                {dismissedCount > 0 && <span> ({dismissedCount} dismissed)</span>}
              </p>
            </div>
          </div>
        </ModalHeaderShell>

        <ModalBodyShell>
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-medium border border-default-200">
              <Table
                aria-label="errors table"
                isHeaderSticky
                isVirtualized
                maxTableHeight={800}
                classNames={{
                  base: "table-fixed",
                  table: "table-fixed",
                  wrapper: "shadow-none",
                  th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                  td: "text-sm select-text group-hover:bg-default-100 first:rounded-l-medium last:rounded-r-medium",
                }}
              >
                <TableHeader columns={columns}>
                  {(column) => (
                    <TableColumn
                      key={column.key}
                      className={`${column.key === "reason" ? "" : "whitespace-nowrap"} ${column.key === "actions" ? "text-right" : ""
                        } ${column.className ?? ""}`}
                    >
                      {column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody items={errors} emptyContent={isComputing ? "Loading errors..." : "No severe errors found"}>
                  {(error) => (
                    <TableRow
                      key={error.id}
                      onClick={() => handleErrorClick(error)}
                      className="cursor-pointer group"
                    >
                      {(columnKey) => {
                        if (columnKey === "band") {
                          return (
                            <TableCell className="font-bold text-default-900">
                              {error.birdEvent.band?.bandGroupId}
                              {error.birdEvent.band?.last2digits}
                            </TableCell>
                          );
                        }
                        if (columnKey === "datetime") {
                          return (
                            <TableCell className="text-default-900">
                              {error.birdEvent.date} {error.birdEvent.time}
                            </TableCell>
                          );
                        }
                        if (columnKey === "species") {
                          return (
                            <TableCell className="text-default-900 font-bold">
                              <SpeciesTooltip speciesCode={error.birdEvent.species} />
                            </TableCell>
                          );
                        }
                        if (columnKey === "reason") {
                          return (
                            <TableCell
                              className={`font-semibold ${error.severity === "danger" ? "text-danger-600" : "text-warning-600"
                                }`}
                            >
                              {error.reason}
                            </TableCell>
                          );
                        }
                        if (columnKey === "actions") {
                          return (
                            <TableCell className="text-left">
                              {isLoggedIn && isOnline && (
                                <Button
                                  onPress={() => handleDismissError(error.id)}
                                  className="text-danger-600"
                                  variant="light"
                                  isIconOnly
                                >
                                  <XMarkIcon className="w-5 h-5" />
                                </Button>
                              )}
                            </TableCell>
                          );
                        }
                        return <TableCell children={undefined} />;
                      }}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ModalBodyShell>

        <ModalFooterShell>
          {isLoggedIn && isOnline && dismissedCount > 0 && (
            <Button color="primary" variant="bordered" onPress={handleResetDismissedErrors}>
              Reset Dismissed Errors
            </Button>
          )}
          <ExportButton
            birdEvents={exportBirdEvents}
            filename="errors.csv"
            additionalComments={exportComments}
          />
          <Button {...modalPrimaryButtonProps} onPress={onClose}>
            Close
          </Button>
        </ModalFooterShell>
      </ModalShell>

      <CaptureHistoryModal
        isOpen={isCaptureHistoryModalOpen}
        onOpenChange={setIsCaptureHistoryModalOpen}
        bandId={selectedBandId}
        birdEventIdToHighlight={selectedBirdEventId || undefined}
      />
    </>
  );
}
