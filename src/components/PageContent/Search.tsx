import { Input, Progress, Select, SelectItem, Chip, Button } from "@heroui/react";
import { useState, useMemo, useCallback } from "react";
import { useData } from "../../services/useData";
import type { Capture } from "../../types";
import CapturesTable from "./Programs/Captures/CapturesTable";

// Capture properties available for filtering
const CAPTURE_PROPERTIES: { key: keyof Capture; label: string; type: "string" | "number" }[] = [
  { key: "bandGroup", label: "Band Group", type: "string" },
  { key: "bandLastTwoDigits", label: "Band Last Two Digits", type: "string" },
  { key: "bandId", label: "Band ID", type: "string" },
  { key: "programId", label: "Program ID", type: "string" },
  { key: "bandPrefix", label: "Band Prefix", type: "string" },
  { key: "bandSuffix", label: "Band Suffix", type: "string" },
  { key: "species", label: "Species", type: "string" },
  { key: "wing", label: "Wing", type: "number" },
  { key: "age", label: "Age", type: "string" },
  { key: "howAged", label: "How Aged", type: "string" },
  { key: "sex", label: "Sex", type: "string" },
  { key: "howSexed", label: "How Sexed", type: "string" },
  { key: "fat", label: "Fat", type: "number" },
  { key: "weight", label: "Weight", type: "number" },
  { key: "date", label: "Date", type: "string" },
  { key: "time", label: "Time", type: "string" },
  { key: "bander", label: "Bander", type: "string" },
  { key: "scribe", label: "Scribe", type: "string" },
  { key: "net", label: "Net", type: "string" },
  { key: "notes", label: "Notes", type: "string" },
  { key: "captureType", label: "Capture Type", type: "string" },
];

// Operators for filtering
const STRING_OPERATORS = [
  { key: "equals", label: "equals" },
  { key: "not_equals", label: "not equals" },
  { key: "contains", label: "contains" },
  { key: "not_contains", label: "not contains" },
  { key: "starts_with", label: "starts with" },
  { key: "ends_with", label: "ends with" },
  { key: "defined", label: "is defined" },
  { key: "not_defined", label: "is not defined" },
];

const NUMBER_OPERATORS = [
  { key: "equals", label: "=" },
  { key: "not_equals", label: "≠" },
  { key: "greater_than", label: ">" },
  { key: "greater_than_or_equal", label: "≥" },
  { key: "less_than", label: "<" },
  { key: "less_than_or_equal", label: "≤" },
  { key: "defined", label: "is defined" },
  { key: "not_defined", label: "is not defined" },
];

interface Filter {
  id: string;
  property: keyof Capture;
  operator: string;
  value: string;
}

export default function Search() {
  const { allCaptures, isLoadingAllCaptures } = useData();

  // Filter state
  const [filters, setFilters] = useState<Filter[]>([]);
  const [currentProperty, setCurrentProperty] = useState<keyof Capture | "">("");
  const [currentOperator, setCurrentOperator] = useState<string>("");
  const [currentValue, setCurrentValue] = useState<string>("");

  // Get property type for current selection
  const currentPropertyType = useMemo(() => {
    const prop = CAPTURE_PROPERTIES.find((p) => p.key === currentProperty);
    return prop?.type ?? "string";
  }, [currentProperty]);

  // Get available operators based on property type
  const availableOperators = useMemo(() => {
    return currentPropertyType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
  }, [currentPropertyType]);

  // Handle property selection change
  const handlePropertyChange = useCallback((keys: Iterable<React.Key>) => {
    const selected = Array.from(keys)[0] as keyof Capture | undefined;
    setCurrentProperty(selected ?? "");
    setCurrentOperator(""); // Reset operator when property changes
  }, []);

  // Check if operator requires a value
  const operatorRequiresValue = currentOperator !== "defined" && currentOperator !== "not_defined";

  // Add a new filter
  const addFilter = useCallback(() => {
    if (!currentProperty || !currentOperator) return;
    if (operatorRequiresValue && !currentValue) return;

    const newFilter: Filter = {
      id: `${Date.now()}-${Math.random()}`,
      property: currentProperty,
      operator: currentOperator,
      value: currentValue,
    };

    setFilters((prev) => [...prev, newFilter]);
    setCurrentProperty("");
    setCurrentOperator("");
    setCurrentValue("");
  }, [currentProperty, currentOperator, currentValue, operatorRequiresValue]);

  // Remove a filter
  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  // Apply filters to captures
  const filteredCaptures = useMemo(() => {
    if (filters.length === 0) return allCaptures;

    return allCaptures.filter((capture) => {
      return filters.every((filter) => {
        const rawValue = capture[filter.property];
        const propType = CAPTURE_PROPERTIES.find((p) => p.key === filter.property)?.type ?? "string";

        // Handle defined/not_defined operators (work for both types)
        if (filter.operator === "defined") {
          return rawValue !== undefined && rawValue !== null && rawValue !== "";
        }
        if (filter.operator === "not_defined") {
          return rawValue === undefined || rawValue === null || rawValue === "";
        }

        if (propType === "number") {
          const captureValue = Number(rawValue) || 0;
          const filterValue = Number(filter.value) || 0;

          switch (filter.operator) {
            case "equals":
              return captureValue === filterValue;
            case "not_equals":
              return captureValue !== filterValue;
            case "greater_than":
              return captureValue > filterValue;
            case "greater_than_or_equal":
              return captureValue >= filterValue;
            case "less_than":
              return captureValue < filterValue;
            case "less_than_or_equal":
              return captureValue <= filterValue;
            default:
              return true;
          }
        } else {
          const captureValue = String(rawValue ?? "").toLowerCase();
          const filterValue = filter.value.toLowerCase();

          switch (filter.operator) {
            case "equals":
              return captureValue === filterValue;
            case "not_equals":
              return captureValue !== filterValue;
            case "contains":
              return captureValue.includes(filterValue);
            case "not_contains":
              return !captureValue.includes(filterValue);
            case "starts_with":
              return captureValue.startsWith(filterValue);
            case "ends_with":
              return captureValue.endsWith(filterValue);
            default:
              return true;
          }
        }
      });
    });
  }, [allCaptures, filters]);

  // Get operator label for display
  const getOperatorLabel = (operator: string, propertyKey: keyof Capture) => {
    const propType = CAPTURE_PROPERTIES.find((p) => p.key === propertyKey)?.type ?? "string";
    const operators = propType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    return operators.find((o) => o.key === operator)?.label ?? operator;
  };

  // Get property label for display
  const getPropertyLabel = (propertyKey: keyof Capture) => {
    return CAPTURE_PROPERTIES.find((p) => p.key === propertyKey)?.label ?? propertyKey;
  };

  const canAddFilter = currentProperty && currentOperator && (operatorRequiresValue ? currentValue : true);

  return (
    <div className="h-full w-full flex flex-col items-center pt-4 p-8 gap-4">
      <div className="w-full flex flex-col gap-4">
        {/* Filter Builder */}
        <div className="flex flex-wrap gap-3 items-end">
          <Select
            label="Property"
            placeholder="Select property"
            variant="bordered"
            labelPlacement="outside"
            size="md"
            selectedKeys={currentProperty ? [currentProperty] : []}
            onSelectionChange={handlePropertyChange}
            className="w-48"
          >
            {CAPTURE_PROPERTIES.map((prop) => (
              <SelectItem key={prop.key}>{prop.label}</SelectItem>
            ))}
          </Select>

          <Select
            label="Operator"
            placeholder="Select operator"
            variant="bordered"
            labelPlacement="outside"
            size="md"
            selectedKeys={currentOperator ? [currentOperator] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string | undefined;
              setCurrentOperator(selected ?? "");
            }}
            className="w-40"
            isDisabled={!currentProperty}
          >
            {availableOperators.map((op) => (
              <SelectItem key={op.key}>{op.label}</SelectItem>
            ))}
          </Select>

          <Input
            label="Value"
            placeholder="Enter value"
            variant="bordered"
            labelPlacement="outside"
            size="md"
            value={currentValue}
            onValueChange={setCurrentValue}
            className="w-48"
            isDisabled={!currentProperty || !operatorRequiresValue}
            type={currentPropertyType === "number" ? "number" : "text"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAddFilter) {
                addFilter();
              }
            }}
          />

          <Button color="secondary" variant="flat" onPress={addFilter} isDisabled={!canAddFilter}>
            Add Filter
          </Button>
        </div>

        {/* Active Filters */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm">Active filters:</span>
            {filters.map((filter) => (
              <div key={filter.id} className="flex items-center gap-1">
                <Chip onClose={() => removeFilter(filter.id)} variant="flat" color="secondary" size="md">
                  {getPropertyLabel(filter.property)} {getOperatorLabel(filter.operator, filter.property)}
                  {filter.operator !== "defined" && filter.operator !== "not_defined" && ` "${filter.value}"`}
                </Chip>
              </div>
            ))}
            <Button variant="light" color="danger" onPress={() => setFilters([])}>
              Clear All
            </Button>
          </div>
        )}

        {isLoadingAllCaptures && (
          <div className="w-full max-w-md flex flex-col gap-2">
            <Progress size="sm" isIndeterminate aria-label="Loading captures..." color="secondary" />
            <p className="text-sm">Loading all captures...</p>
          </div>
        )}

        {!isLoadingAllCaptures && filters.length > 0 && filteredCaptures.length > 0 && (
          <div className="w-full">
            <h3 className="text-lg font-normal mb-2">
              Filtered results ({filteredCaptures.length} of {allCaptures.length}):
            </h3>
            <CapturesTable
              captures={filteredCaptures}
              maxTableHeight={600}
              sortColumn="date"
              sortDirection="descending"
            />
          </div>
        )}

        {!isLoadingAllCaptures && filters.length > 0 && filteredCaptures.length === 0 && (
          <div className="p-4">No captures match the current filters</div>
        )}
      </div>
    </div>
  );
}
