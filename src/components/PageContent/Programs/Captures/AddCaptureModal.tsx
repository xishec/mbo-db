import {
  Button,
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
import { useState } from "react";

interface AddCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface CaptureFormData {
  program: string;
  bandGroupId: string;
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

const initialFormData: CaptureFormData = {
  program: "",
  bandGroupId: "",
  bandLastTwoDigits: "",
  species: "",
  wing: "",
  age: "",
  howAged: "",
  sex: "",
  howSexed: "",
  fat: "",
  weight: "",
  date: "",
  time: "",
  bander: "",
  scribe: "",
  net: "",
  notes: "",
};

const CAPTURE_COLUMNS: { key: keyof CaptureFormData; label: string; type?: string; className?: string }[] = [
  { key: "program", label: "Program", className: "min-w-[150px]" },
  { key: "bandGroupId", label: "Band Group", className: "" },
  { key: "bandLastTwoDigits", label: "Band", className: "" },
  { key: "species", label: "Species", className: "min-" },
  { key: "wing", label: "Wing", type: "number", className: "" },
  { key: "age", label: "Age", className: "" },
  { key: "howAged", label: "How Aged", className: "" },
  { key: "sex", label: "Sex", className: "" },
  { key: "howSexed", label: "How Sexed", className: "" },
  { key: "fat", label: "Fat", type: "number", className: "" },
  { key: "weight", label: "Weight", type: "number", className: "" },
  { key: "date", label: "Date", type: "date", className: "min-" },
  { key: "time", label: "Time", type: "time", className: "min-" },
  { key: "bander", label: "Bander", className: "" },
  { key: "scribe", label: "Scribe", className: "" },
  { key: "net", label: "Net", className: "" },
  { key: "notes", label: "Notes", className: "min-w-[150px]" },
];

export default function AddCaptureModal({ isOpen, onOpenChange }: AddCaptureModalProps) {
  const [formData, setFormData] = useState<CaptureFormData>(initialFormData);

  const handleInputChange = (field: keyof CaptureFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setFormData(initialFormData);
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
            <ModalHeader className="flex flex-col gap-1 p-8 pb-0">Add New Capture</ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              <Table aria-label="Add capture form" removeWrapper>
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
                          size="sm"
                          variant="bordered"
                          aria-label={column.label}
                          type={column.type || "text"}
                          value={formData[column.key]}
                          onChange={(e) => handleInputChange(column.key, e.target.value)}
                          classNames={{
                            input: "text-sm",
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
                Save Capture
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
