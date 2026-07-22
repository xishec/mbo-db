import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useAppStore, useActions, useIsLoggedIn } from "../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { BIRD_EVENT_ERROR_TYPE_CONFIG, type BirdEventError, findBirdEventErrors } from "../../types/birdEventErrors";
import CaptureHistoryModal from "./CaptureHistoryModal";
import ExportButton from "../Helper/ExportButton";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../types/species";

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ErrorColumn = {
  key: "band" | "datetime" | "species" | "errorType" | "reason" | "actions";
  label: string;
  className?: string;
  allowsSorting?: boolean;
};

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const bandIdToBirdEventIdsMap = useAppStore((s) => s.bandIdToBirdEventIdsMap);
  const magicTable = useAppStore((s) => s.magicTable);
  const dismissedConflictsMap = useAppStore((s) => s.dismissedConflictsMap);
  const isOnline = useAppStore((s) => s.isOnline);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);
  const isLoggedIn = useIsLoggedIn();
  const { dismissConflict, resetDismissedConflicts } = useActions();
  const birdEventsVersion = useBirdEventsVersion();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);
  const [errorsState, setErrorsState] = useState<{ errors: BirdEventError[]; dismissedCount: number }>({
    errors: [],
    dismissedCount: 0,
  });
  const [isComputing, setIsComputing] = useState(false);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "datetime",
    direction: "descending",
  });

  useEffect(() => {
    // Only scan when the modal is actually open. Running this on every
    // birdEventsMap change (even via requestIdleCallback) burns CPU on slow
    // laptops — the scan iterates thousands of bands. The badge count in
    // Navigation is disabled, so the modal is the only consumer.
    if (!isOpen) return;
    if (!isOnline) return;

    let cancelled = false;
    setIsComputing(true);

    const timeoutId = setTimeout(() => {
      const allErrors = findBirdEventErrors(
        bandIdToBirdEventIdsMap,
        birdEventsStore.getAll(),
        magicTable,
        speciesAliasesMap,
        bandResetsMap
      );
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

      if (!cancelled) {
        setErrorsState({ errors: activeErrors, dismissedCount });
        setIsComputing(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    isOpen,
    isOnline,
    bandIdToBirdEventIdsMap,
    birdEventsVersion,
    magicTable,
    dismissedConflictsMap,
    speciesAliasesMap,
    bandResetsMap,
  ]);

  const { errors, dismissedCount } = errorsState;
  const sortedErrors = useMemo(() => {
    const typeLabels = BIRD_EVENT_ERROR_TYPE_CONFIG;

    return [...errors].sort((a, b) => {
      let comparison = 0;

      switch (sortDescriptor.column) {
        case "band": {
          const aBand = `${a.birdEvent.band?.bandGroupId ?? ""}${a.birdEvent.band?.last2digits ?? ""}`;
          const bBand = `${b.birdEvent.band?.bandGroupId ?? ""}${b.birdEvent.band?.last2digits ?? ""}`;
          comparison = aBand.localeCompare(bBand);
          break;
        }
        case "species": {
          const aSpecies = getSpeciesDisplayCode(resolveSpeciesKey(a.birdEvent.species, speciesAliasesMap), speciesAliasesMap);
          const bSpecies = getSpeciesDisplayCode(
            resolveSpeciesKey(b.birdEvent.species, speciesAliasesMap),
            speciesAliasesMap
          );
          comparison = aSpecies.localeCompare(bSpecies);
          break;
        }
        case "errorType":
          comparison = typeLabels[a.errorType].label.localeCompare(typeLabels[b.errorType].label);
          break;
        case "reason":
          comparison = a.reason.localeCompare(b.reason);
          break;
        case "datetime":
        default: {
          const aTime = parseInt(a.birdEvent.updatedAt || "0", 10);
          const bTime = parseInt(b.birdEvent.updatedAt || "0", 10);
          comparison = aTime - bTime;
          break;
        }
      }

      if (comparison !== 0) {
        return sortDescriptor.direction === "descending" ? -comparison : comparison;
      }

      const aTime = parseInt(a.birdEvent.updatedAt || "0", 10);
      const bTime = parseInt(b.birdEvent.updatedAt || "0", 10);
      return bTime - aTime;
    });
  }, [errors, sortDescriptor, speciesAliasesMap]);

  const exportBirdEvents = useMemo(() => sortedErrors.map((error) => error.birdEvent), [sortedErrors]);
  const exportComments = useMemo(
    () =>
      sortedErrors.reduce(
        (acc, error) => {
          acc[error.birdEvent.id] = error.reason;
          return acc;
        },
        {} as Record<string, string>
      ),
    [sortedErrors]
  );

  const columns = useMemo<ErrorColumn[]>(
    () => [
      { key: "band", label: "Band", className: "w-[100px]", allowsSorting: true },
      { key: "datetime", label: "Date/Time", className: "w-[200px]", allowsSorting: true },
      { key: "species", label: "Species", className: "w-[100px]", allowsSorting: true },
      { key: "errorType", label: "Error Type", className: "w-[180px]", allowsSorting: true },
      { key: "reason", label: "Reason", className: "w-auto", allowsSorting: true },
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

  const handleSortChange = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
  };

  return (
    <>
      <ModalShell
        modalProps={{
          isDismissable: false,
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
                {sortedErrors.length} errors found
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
                sortDescriptor={sortDescriptor}
                onSortChange={handleSortChange}
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
                      allowsSorting={column.allowsSorting}
                      className={`${column.key === "reason" ? "" : "whitespace-nowrap"} ${
                        column.key === "actions" ? "text-right" : ""
                      } ${column.className ?? ""}`}
                    >
                      {column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody items={sortedErrors} emptyContent={isComputing ? "Loading errors..." : "No errors found"}>
                  {(error) => (
                    <TableRow key={error.id} onClick={() => handleErrorClick(error)} className="cursor-pointer group">
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
                        if (columnKey === "errorType") {
                          return (
                            <TableCell className="text-default-900 whitespace-nowrap">
                              {BIRD_EVENT_ERROR_TYPE_CONFIG[error.errorType].label}
                            </TableCell>
                          );
                        }
                        if (columnKey === "reason") {
                          return (
                            <TableCell
                              className={`font-semibold ${
                                error.severity === "danger" ? "text-danger-600" : "text-warning-600"
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
          <ExportButton birdEvents={exportBirdEvents} filename="errors.csv" additionalComments={exportComments} />
          <Button color="primary" variant="bordered" onPress={onClose}>
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
