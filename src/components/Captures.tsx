import { Autocomplete, AutocompleteItem, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import type { Programs } from "../types/Programs";

interface CapturesProps {
  programs?: Programs | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function Captures({
  programs,
  isLoading,
  error,
}: CapturesProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const programNames = useMemo(
    () => (programs ? Array.from(programs.keys()) : []),
    [programs]
  );
  const selectedEntries = useMemo(() => {
    if (!programs || !selectedKey) return null;
    return programs.get(selectedKey) || null;
  }, [programs, selectedKey]);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-danger">Error: {error}</div>;
  }
  if (!programs || programNames.length === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-6 max-w-xl">
      <Autocomplete
        variant="bordered"
        label="Programs"
        className="max-w-full"
        defaultItems={programNames.map((name) => ({ key: name, label: name }))}
        selectedKey={selectedKey ?? undefined}
        onSelectionChange={(key) => setSelectedKey(key ? String(key) : null)}
        allowsCustomValue={false}
      >
        {(item) => (
          <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>
        )}
      </Autocomplete>

      {selectedKey && (
        <div className="rounded-medium border border-default-200 p-4 bg-default-50 dark:bg-default-100">
          <h3 className="text-lg font-semibold mb-2">Program: {selectedKey}</h3>
          <p className="text-sm mb-3">Entries: {selectedEntries?.size ?? 0}</p>
          {selectedEntries && selectedEntries.size > 0 ? (
            <ul className="list-disc pl-5 text-sm space-y-1 max-h-64 overflow-auto">
              {Array.from(selectedEntries.values()).map((val) => (
                <li key={val}>{val}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm italic text-default-500">
              No entries for this program.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
