import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useRef, useState } from "react";
import { useProgramData } from "../../../../services/useProgramData";

interface AddCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface CaptureFormData {
  program: string;
  bandPrefix: string;
  bandSuffix: string;
  bandLastTwoDigits: string;
  species: string;
  wing: string;
  age: string;
  howAged: string;
  sex: string;
  howSexed: string;
  fat: string;
  weight: string;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  notes: string;
}

const getDefaultFormData = (program: string): CaptureFormData => {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5); // HH:MM

  return {
    program,
    bandPrefix: "",
    bandSuffix: "",
    bandLastTwoDigits: "",
    species: "",
    wing: "",
    age: "",
    howAged: "",
    sex: "",
    howSexed: "",
    fat: "",
    weight: "",
    date,
    time,
    bander: "",
    scribe: "",
    net: "",
    notes: "",
  };
};

const CAPTURE_COLUMNS: {
  key: keyof CaptureFormData;
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
}[] = [
  { key: "bandPrefix", label: "Band Prefix", className: "", maxLength: 4 },
  { key: "bandSuffix", label: "Band Suffix", className: "", maxLength: 3 },
  { key: "bandLastTwoDigits", label: "Band", className: "", maxLength: 2 },
  { key: "species", label: "Species", className: "", maxLength: 4 },
  { key: "wing", label: "Wing", className: "min-w-[60px]" },
  { key: "age", label: "Age", className: "", maxLength: 1 },
  { key: "howAged", label: "How Aged", className: "", maxLength: 1 },
  { key: "sex", label: "Sex", className: "", maxLength: 1 },
  { key: "howSexed", label: "How Sexed", className: "", maxLength: 1 },
  { key: "fat", label: "Fat", className: "", maxLength: 1 },
  { key: "weight", label: "Weight", className: "" },
  { key: "date", label: "Date", type: "date", className: "" },
  { key: "time", label: "Time", type: "time", className: "" },
  { key: "bander", label: "Bander", className: "", maxLength: 3 },
  { key: "scribe", label: "Scribe", className: "", maxLength: 3 },
  { key: "net", label: "Net", className: "", maxLength: 2 },
  { key: "notes", label: "Notes", className: "min-w-[150px]" },
];

export default function AddCaptureModal({ isOpen, onOpenChange }: AddCaptureModalProps) {
  const { selectedProgram } = useProgramData();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram || ""));
  const [lastOpenState, setLastOpenState] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Reset form data when modal opens
  if (isOpen && !lastOpenState) {
    setFormData(getDefaultFormData(selectedProgram || ""));
  }
  if (isOpen !== lastOpenState) {
    setLastOpenState(isOpen);
  }

  const handleInputChange = (field: keyof CaptureFormData, value: string, maxLength?: number) => {
    // Limit bandPrefix to 4 digits only
    if (field === "bandPrefix") {
      value = value.replace(/\D/g, "").slice(0, 4);
    }
    // Limit bandSuffix to 3 digits only
    if (field === "bandSuffix") {
      value = value.replace(/\D/g, "").slice(0, 3);
    }
    // Limit bandLastTwoDigits to 2 digits only
    if (field === "bandLastTwoDigits") {
      value = value.replace(/\D/g, "").slice(0, 2);
    }
    // Species: 4 letters only
    if (field === "species") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 4);
    }
    // Wing: digits only (no decimal)
    if (field === "wing") {
      value = value.replace(/\D/g, "");
    }
    // Age: 1 digit only
    if (field === "age") {
      value = value.replace(/\D/g, "").slice(0, 1);
    }
    // How Aged: 1 digit only
    if (field === "howAged") {
      value = value.replace(/\D/g, "").slice(0, 1);
    }
    // Sex: 1 digit only
    if (field === "sex") {
      value = value.replace(/\D/g, "").slice(0, 1);
    }
    // How Sexed: 1 letter or number
    if (field === "howSexed") {
      value = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 1);
    }
    // Fat: 1 digit only
    if (field === "fat") {
      value = value.replace(/\D/g, "").slice(0, 1);
    }
    // Weight: number with 1 decimal digit (e.g., 12.3)
    if (field === "weight") {
      // Allow only digits and one decimal point
      value = value.replace(/[^0-9.]/g, "");
      // Only allow one decimal point
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }
      // Limit to 1 decimal digit
      if (parts.length === 2 && parts[1].length > 1) {
        value = parts[0] + "." + parts[1].slice(0, 1);
      }
    }
    // Bander: 3 letters only
    if (field === "bander") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
    }
    // Scribe: 3 letters only
    if (field === "scribe") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
    }
    // Net: 2 letters or numbers
    if (field === "net") {
      value = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 2);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-focus next input when maxLength is reached
    if (maxLength && value.length >= maxLength) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    }

    // Auto-focus next input for weight after decimal digit is entered
    if (field === "weight" && value.includes(".") && value.split(".")[1]?.length === 1) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: keyof CaptureFormData) => {
    if (e.key === "Tab" && !e.shiftKey) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        e.preventDefault();
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex > 0) {
        e.preventDefault();
        const prevKey = CAPTURE_COLUMNS[currentIndex - 1].key;
        const prevInput = inputRefs.current.get(prevKey);
        prevInput?.focus();
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log("Saving capture:", formData);
    handleClose();
  };

  return (
    <Modal
      isKeyboardDismissDisabled={true}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="!max-w-[calc(100%-4rem)]"
      scrollBehavior="inside"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-row items-center gap-1 p-8 pb-0 font-normal">
              Add Capture in <span className="font-bold">{selectedProgram}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              <Table removeWrapper>
                <TableHeader columns={CAPTURE_COLUMNS}>
                  {(column) => (
                    <TableColumn key={column.key} className={`whitespace-nowrap ${column.className || ""}`}>
                      {column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody>
                  <TableRow key="new-capture">
                    {CAPTURE_COLUMNS.map((column) => (
                      <TableCell key={column.key} className="p-1">
                        <Input
                          ref={(el) => {
                            if (el) inputRefs.current.set(column.key, el);
                          }}
                          variant="bordered"
                          aria-label={column.label}
                          type={column.type || "text"}
                          maxLength={column.maxLength}
                          value={formData[column.key]}
                          onChange={(e) => handleInputChange(column.key, e.target.value, column.maxLength)}
                          onKeyDown={(e) => handleKeyDown(e, column.key)}
                          classNames={{
                            input:
                              "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            inputWrapper: "min-h-unit-8 h-unit-8",
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-0">
              <Button color="danger" variant="light" onPress={handleClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
