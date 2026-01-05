import { Input, Progress, Select, SelectItem, Chip, Button } from "@heroui/react";
import { useState, useMemo, useCallback } from "react";
import { useData } from "../../services/useData";
import type { BirdEvent, CaptureColumn } from "../../types";
import { TABLE_COLUMNS } from "./Programs/Captures/helpers";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";

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
  property: (typeof TABLE_COLUMNS)[number]["key"];
  operator: string;
  value: string;
}

export default function Search() {
  const { birdEventsMap, isLoading } = useData();

  // Convert birdEventsMap to array
  const allBirdEvents = useMemo(
    () =>
      Object.values(birdEventsMap)
        .filter((event) => event.modifiedEventId == null)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [birdEventsMap]
  );

  // Filter state
  const [filters, setFilters] = useState<Filter[]>([]);
  const [currentProperty, setCurrentProperty] = useState<(typeof TABLE_COLUMNS)[number]["key"] | "">("");
  const [currentOperator, setCurrentOperator] = useState<string>("");
  const [currentValue, setCurrentValue] = useState<string>("");

  // Get property type for current selection
  const currentPropertyType = useMemo(() => {
    const prop = TABLE_COLUMNS.find((p: CaptureColumn) => p.key === currentProperty);
    return prop?.type ?? "string";
  }, [currentProperty]);

  // Get available operators based on property type
  const availableOperators = useMemo(() => {
    return currentPropertyType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
  }, [currentPropertyType]);

  // Handle property selection change
  const handlePropertyChange = useCallback((keys: Iterable<React.Key>) => {
    const selected = Array.from(keys)[0] as (typeof TABLE_COLUMNS)[number]["key"] | undefined;
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

  // Helper function to get value from BirdEvent based on property key
  const getEventValue = (event: BirdEvent, propertyKey: string): string | number | undefined => {
    switch (propertyKey) {
      case "bandGroup":
        return event.band.bandGroupId;
      case "bandLastTwoDigits":
        return event.band.last2digits;
      case "programId":
      case "species":
      case "age":
      case "howAged":
      case "sex":
      case "howSexed":
      case "date":
      case "time":
      case "bander":
      case "scribe":
      case "net":
      case "notes":
        return event[propertyKey];
      case "wing":
      case "fat":
      case "weight":
        return event[propertyKey];
      case "birdEventType":
        return event.birdEventType;
      default:
        return undefined;
    }
  };

  // Apply filters to birdEvents
  const filteredBirdEvents = useMemo(() => {
    if (filters.length === 0) return allBirdEvents;

    return allBirdEvents.filter((birdEvent: BirdEvent) => {
      return filters.every((filter) => {
        const rawValue = getEventValue(birdEvent, filter.property);
        const propType = TABLE_COLUMNS.find((p: CaptureColumn) => p.key === filter.property)?.type ?? "string";

        // Handle defined/not_defined operators (work for both types)
        if (filter.operator === "defined") {
          return rawValue !== undefined && rawValue !== null && rawValue !== "";
        }
        if (filter.operator === "not_defined") {
          return rawValue === undefined || rawValue === null || rawValue === "";
        }

        if (propType === "number") {
          const birdEventValue = Number(rawValue) || 0;
          const filterValue = Number(filter.value) || 0;

          switch (filter.operator) {
            case "equals":
              return birdEventValue === filterValue;
            case "not_equals":
              return birdEventValue !== filterValue;
            case "greater_than":
              return birdEventValue > filterValue;
            case "greater_than_or_equal":
              return birdEventValue >= filterValue;
            case "less_than":
              return birdEventValue < filterValue;
            case "less_than_or_equal":
              return birdEventValue <= filterValue;
            default:
              return true;
          }
        } else {
          const birdEventValue = String(rawValue ?? "").toLowerCase();
          const filterValue = filter.value.toLowerCase();

          switch (filter.operator) {
            case "equals":
              return birdEventValue === filterValue;
            case "not_equals":
              return birdEventValue !== filterValue;
            case "contains":
              return birdEventValue.includes(filterValue);
            case "not_contains":
              return !birdEventValue.includes(filterValue);
            case "starts_with":
              return birdEventValue.startsWith(filterValue);
            case "ends_with":
              return birdEventValue.endsWith(filterValue);
            default:
              return true;
          }
        }
      });
    });
  }, [allBirdEvents, filters]);

  // Get operator label for display
  const getOperatorLabel = (operator: string, propertyKey: string) => {
    const propType = TABLE_COLUMNS.find((p: CaptureColumn) => p.key === propertyKey)?.type ?? "string";
    const operators = propType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    return operators.find((o) => o.key === operator)?.label ?? operator;
  };

  // Get property label for display
  const getPropertyLabel = (propertyKey: string) => {
    return TABLE_COLUMNS.find((p: CaptureColumn) => p.key === propertyKey)?.label ?? propertyKey;
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
            selectedKeys={currentProperty ? [currentProperty as string] : []}
            onSelectionChange={handlePropertyChange}
            className="w-48"
          >
            {TABLE_COLUMNS.filter((col) => col.key !== "actions").map((prop: CaptureColumn) => (
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
                  {getPropertyLabel(filter.property as string)} {getOperatorLabel(filter.operator, filter.property)}
                  {filter.operator !== "defined" && filter.operator !== "not_defined" && ` "${filter.value}"`}
                </Chip>
              </div>
            ))}
            <Button variant="light" color="danger" onPress={() => setFilters([])}>
              Clear All
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="w-full max-w-md flex flex-col gap-2">
            <Progress size="sm" isIndeterminate aria-label="Loading birdEvents..." color="secondary" />
            <p className="text-sm">Loading all birdEvents...</p>
          </div>
        )}

        {!isLoading && filters.length > 0 && filteredBirdEvents.length > 0 && (
          <div className="w-full">
            <h3 className="text-lg font-normal mb-2">
              Filtered results ({filteredBirdEvents.length} of {allBirdEvents.length}):
            </h3>
            <BirdEventsTable
              birdEvents={filteredBirdEvents.slice(0, 999)}
              maxTableHeight={600}
              sortDescriptors={[{ column: "date", direction: "descending" }]}
              allowInspectBandId
            />
          </div>
        )}

        {!isLoading && filters.length > 0 && filteredBirdEvents.length === 0 && (
          <div className="p-4">No birdEvents match the current filters</div>
        )}
      </div>
    </div>
  );
}
