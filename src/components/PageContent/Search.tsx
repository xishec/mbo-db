import { Input, Progress, Select, SelectItem, Chip, Button } from "@heroui/react";
import { useState, useMemo, useCallback } from "react";
import { useData } from "../../services/useData";
import type { BirdEvent } from "../../types";
import { TABLE_COLUMNS } from "./Programs/Captures/helpers";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import ExportButton from "../Helper/ExportButton";
import PageHeader from "./PageHeader";

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

type LogicOperator = "AND" | "OR";

interface Filter {
  id: string;
  property: (typeof TABLE_COLUMNS)[number]["key"];
  operator: string;
  value: string;
  logic: LogicOperator;
}

const SEARCH_COLUMNS = [
  { key: "bandId", type: "text", label: "Band ID" },
  ...TABLE_COLUMNS.filter((col) => col.key !== "actions" && col.key !== "bandGroup" && col.key !== "bandLastTwoDigits"),
];

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
  const [currentLogic, setCurrentLogic] = useState<LogicOperator>("AND");

  // Get property type for current selection
  const currentPropertyType = useMemo(() => {
    const prop = SEARCH_COLUMNS.find((p) => p.key === currentProperty);
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
      logic: currentLogic,
    };

    setFilters((prev) => [...prev, newFilter]);
    setCurrentProperty("");
    setCurrentOperator("");
    setCurrentValue("");
  }, [currentProperty, currentOperator, currentValue, operatorRequiresValue, currentLogic]);

  // Remove a filter
  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  // Helper function to get value from BirdEvent based on property key
  const getEventValue = (event: BirdEvent, propertyKey: string): string | number | undefined => {
    switch (propertyKey) {
      case "bandId":
        return event.band.id;
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
      case "birdStatus":
        return event.birdStatus;
      case "birdEventType":
        return event.birdEventType;
      default:
        return undefined;
    }
  };

  // Evaluate a single filter against a bird event
  const matchesFilter = useCallback((birdEvent: BirdEvent, filter: Filter): boolean => {
    const rawValue = getEventValue(birdEvent, filter.property);
    const propType = SEARCH_COLUMNS.find((p) => p.key === filter.property)?.type ?? "string";

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
        case "equals": return birdEventValue === filterValue;
        case "not_equals": return birdEventValue !== filterValue;
        case "greater_than": return birdEventValue > filterValue;
        case "greater_than_or_equal": return birdEventValue >= filterValue;
        case "less_than": return birdEventValue < filterValue;
        case "less_than_or_equal": return birdEventValue <= filterValue;
        default: return true;
      }
    } else {
      const birdEventValue = String(rawValue ?? "").toLowerCase();
      const filterValue = filter.value.toLowerCase();

      switch (filter.operator) {
        case "equals": return birdEventValue === filterValue;
        case "not_equals": return birdEventValue !== filterValue;
        case "contains": return birdEventValue.includes(filterValue);
        case "not_contains": return !birdEventValue.includes(filterValue);
        case "starts_with": return birdEventValue.startsWith(filterValue);
        case "ends_with": return birdEventValue.endsWith(filterValue);
        default: return true;
      }
    }
  }, []);

  // Apply filters: AND before OR
  // Split into AND-groups at OR boundaries, evaluate each group with every(), combine with some()
  const filteredBirdEvents = useMemo(() => {
    if (filters.length === 0) return allBirdEvents;

    // Split filters into AND-groups separated by OR
    const andGroups: Filter[][] = [[]];
    for (const filter of filters) {
      if (filter.logic === "OR" && andGroups[andGroups.length - 1].length > 0) {
        andGroups.push([]);
      }
      andGroups[andGroups.length - 1].push(filter);
    }

    return allBirdEvents.filter((birdEvent: BirdEvent) =>
      andGroups.some((group) => group.every((filter) => matchesFilter(birdEvent, filter)))
    );
  }, [allBirdEvents, filters, matchesFilter]);

  // Get operator label for display
  const getOperatorLabel = (operator: string, propertyKey: string) => {
    const propType = SEARCH_COLUMNS.find((p) => p.key === propertyKey)?.type ?? "string";
    const operators = propType === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    return operators.find((o) => o.key === operator)?.label ?? operator;
  };

  const getPropertyLabel = (propertyKey: string) => {
    return SEARCH_COLUMNS.find((p) => p.key === propertyKey)?.label ?? propertyKey;
  };

  const canAddFilter = currentProperty && currentOperator && (operatorRequiresValue ? currentValue : true);

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4">
      <div className="w-full">
        <PageHeader title="Search" subtitle="Filter and export capture records." />
      </div>
      <div className="w-full flex flex-col gap-4">
        {/* Filter Builder */}
        <div className="w-full flex flex-wrap gap-3 items-end">
          {filters.length > 0 && (
            <Select
              label="Logic"
              variant="bordered"
              labelPlacement="outside"
              size="md"
              selectedKeys={[currentLogic]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as LogicOperator | undefined;
                if (selected) setCurrentLogic(selected);
              }}
              className="w-24"
            >
              <SelectItem key="AND">AND</SelectItem>
              <SelectItem key="OR">OR</SelectItem>
            </Select>
          )}
          <Select
            label="Property"
            placeholder="Select property"
            variant="bordered"
            labelPlacement="outside"
            size="md"
            selectedKeys={currentProperty ? [currentProperty as string] : []}
            onSelectionChange={handlePropertyChange}
            className="flex-1"
          >
            {SEARCH_COLUMNS.map((prop) => (
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
            className="flex-1"
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
            className="flex-1"
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
            {filters.map((filter, index) => (
              <div key={filter.id} className="flex items-center gap-1">
                {index > 0 && (
                  <span className="text-xs font-semibold text-default-700 px-1">{filter.logic}</span>
                )}
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
            <div className="flex justify-between items-center mb-2">
              <ExportButton
                birdEvents={filteredBirdEvents}
                filename={`filtered_bird_events_${new Date().toISOString().split('T')[0]}.csv`}
              />
            </div>
            {filteredBirdEvents.length > 999 && (
              <div className="my-4 p-2 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <p className="text-sm text-warning-800 dark:text-warning-200">
                  <strong>Too many results:</strong> Showing first 999 of {filteredBirdEvents.length} results. 
                  Please add more filters to narrow down your search. Export will include all {filteredBirdEvents.length} results.
                </p>
              </div>
            )}
            <BirdEventsTable
              birdEvents={filteredBirdEvents}
              maxTableHeight={600}
              maxRows={999}
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
