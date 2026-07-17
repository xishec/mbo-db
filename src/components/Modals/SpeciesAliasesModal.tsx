import {
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from "@heroui/react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { useAppStore, useActions } from "../../stores/useAppStore";
import { SPECIES_KEY_BY_CURRENT_CODE, SPECIES_MAP } from "../../types/species";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalCancelButtonProps, modalInputProps, modalPrimaryButtonProps } from "./modalDefaults";

type AliasRow = {
  aliasCode: string;
  speciesKey: string;
  speciesName: string;
};

interface SpeciesAliasesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SpeciesAliasesModal({ isOpen, onOpenChange }: SpeciesAliasesModalProps) {
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const isOnline = useAppStore((s) => s.isOnline);
  const user = useAppStore((s) => s.user);
  const { updateSpeciesAlias } = useActions();
  const [aliasCode, setAliasCode] = useState("");
  const [speciesKey, setSpeciesKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const rows = useMemo<AliasRow[]>(
    () =>
      Object.entries(speciesAliasesMap)
        .map(([alias, key]) => ({
          aliasCode: alias,
          speciesKey: key,
          speciesName: SPECIES_MAP[key]?.speciesDescriptionMBO ?? "Unknown",
        }))
        .sort((a, b) => a.aliasCode.localeCompare(b.aliasCode)),
    [speciesAliasesMap]
  );

  const speciesOptions = useMemo(
    () =>
      Object.entries(SPECIES_MAP)
        .map(([key, species]) => ({
          key,
          label: `${key} - ${species.speciesDescriptionMBO || species.speciesDescriptionCMMN}`,
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    []
  );

  const normalizedAlias = aliasCode.toUpperCase();
  const canSave =
    !!user &&
    isOnline &&
    /^[A-Z]{4}$/.test(normalizedAlias) &&
    !!speciesKey &&
    !SPECIES_KEY_BY_CURRENT_CODE[normalizedAlias] &&
    !speciesAliasesMap[normalizedAlias] &&
    !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await updateSpeciesAlias(normalizedAlias, speciesKey);
      setAliasCode("");
      setSpeciesKey("");
    } catch (err) {
      addToast({
        title: "Could not save alias",
        description: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (alias: string) => {
    setIsSaving(true);
    try {
      await updateSpeciesAlias(alias, null);
    } catch (err) {
      addToast({
        title: "Could not delete alias",
        description: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      modalProps={{
        isOpen,
        onOpenChange,
        size: "3xl",
        scrollBehavior: "inside",
      }}
    >
      {(onClose) => (
        <>
          <ModalHeaderShell>
            <h2 className="text-xl font-bold">Species Aliases</h2>
          </ModalHeaderShell>
          <ModalBodyShell>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
                <Select
                  label="Species"
                  labelPlacement="outside"
                  size="sm"
                  variant="bordered"
                  selectedKeys={speciesKey ? [speciesKey] : []}
                  onSelectionChange={(keys) => setSpeciesKey(String(Array.from(keys)[0] ?? ""))}
                  isDisabled={isSaving || !user || !isOnline}
                  classNames={{ trigger: "h-10 min-h-10" }}
                >
                  {speciesOptions.map((option) => (
                    <SelectItem key={option.key}>{option.label}</SelectItem>
                  ))}
                </Select>
                <Input
                  {...modalInputProps}
                  label="Alias"
                  placeholder=" "
                  maxLength={4}
                  size="sm"
                  value={aliasCode}
                  onChange={(e) =>
                    setAliasCode(
                      e.target.value
                        .replace(/[^a-zA-Z]/g, "")
                        .toUpperCase()
                        .slice(0, 4)
                    )
                  }
                  isDisabled={isSaving || !user || !isOnline}
                  classNames={{ inputWrapper: "h-10 min-h-10" }}
                />
                <Button
                  {...modalPrimaryButtonProps}
                  size="sm"
                  className="h-10 min-h-10"
                  onPress={handleSave}
                  isDisabled={!canSave}
                  isLoading={isSaving}
                >
                  Add
                </Button>
              </div>

              <Table aria-label="Species aliases table" removeWrapper>
                <TableHeader>
                  <TableColumn>Alias</TableColumn>
                  <TableColumn>Species Key</TableColumn>
                  <TableColumn>Species</TableColumn>
                  <TableColumn width={60}> </TableColumn>
                </TableHeader>
                <TableBody items={rows} emptyContent="No aliases">
                  {(row) => (
                    <TableRow key={row.aliasCode}>
                      <TableCell className="font-mono">{row.aliasCode}</TableCell>
                      <TableCell className="font-mono">{row.speciesKey}</TableCell>
                      <TableCell>{row.speciesName}</TableCell>
                      <TableCell>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          aria-label={`Delete alias ${row.aliasCode}`}
                          onPress={() => handleDelete(row.aliasCode)}
                          isDisabled={isSaving || !user || !isOnline}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ModalBodyShell>
          <ModalFooterShell>
            <Button {...modalCancelButtonProps} onPress={onClose}>
              Close
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
