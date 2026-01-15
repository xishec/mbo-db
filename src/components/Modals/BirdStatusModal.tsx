import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import { useMemo, useState } from "react";
import { BIRD_STATUS_CODES, BIRD_STATUS_GROUPS, getCodesForGroup } from "../../types/birdStatus";

interface BirdStatusModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentStatus: string;
  onStatusChange: (status: string) => void;
}

export default function BirdStatusModal({ isOpen, onOpenChange, currentStatus, onStatusChange }: BirdStatusModalProps) {
  // Find the group that contains the current status
  const getGroupForStatus = (status: string) => {
    const prefix = status.charAt(0);
    const group = BIRD_STATUS_GROUPS.find((g) => g.id.startsWith(prefix));
    return group?.id || "300";
  };

  const [selectedGroup, setSelectedGroup] = useState(() => getGroupForStatus(currentStatus));
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [lastOpenState, setLastOpenState] = useState(isOpen);

  // Get available codes for the selected group
  const availableCodes = useMemo(() => {
    return getCodesForGroup(selectedGroup);
  }, [selectedGroup]);

  // Handle modal opening/closing - reset to current status when opening
  if (isOpen && !lastOpenState) {
    const newGroup = getGroupForStatus(currentStatus);
    setLastOpenState(true);
    setSelectedGroup(newGroup);
    setSelectedStatus(currentStatus);
  } else if (!isOpen && lastOpenState) {
    setLastOpenState(false);
  }

  // Handle group change - update status if needed
  const handleGroupChange = (newGroup: string) => {
    setSelectedGroup(newGroup);
    const codes = getCodesForGroup(newGroup);
    // If current selection is not in new group, select first code
    if (!codes.includes(selectedStatus)) {
      setSelectedStatus(codes[0] || "300");
    }
  };

  const handleSave = () => {
    onStatusChange(selectedStatus);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedGroup(getGroupForStatus(currentStatus));
    setSelectedStatus(currentStatus);
    onOpenChange(false);
  };

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-row items-center justify-between p-8 pb-0 font-normal">
              <div className="flex flex-row items-center gap-1 font-bold">Select Bird Status</div>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {/* Select Group */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground-600">Status Category</label>
                <Select
                  selectedKeys={[selectedGroup]}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  placeholder="Select a category"
                  variant="bordered"
                  disallowEmptySelection
                  classNames={{
                    value: "text-sm",
                  }}
                >
                  {BIRD_STATUS_GROUPS.map((group) => (
                    <SelectItem key={group.id} textValue={group.label}>
                      <div className="flex flex-col">
                        <span className="font-medium">{group.label}</span>
                        <span className="text-xs text-foreground-500">{group.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Select Specific Code */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground-600">Status Code</label>
                <Select
                  selectedKeys={[selectedStatus]}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  placeholder="Select a status code"
                  variant="bordered"
                  disallowEmptySelection
                  classNames={{
                    value: "text-sm",
                  }}
                >
                  {availableCodes.map((code) => {
                    const statusInfo = BIRD_STATUS_CODES[code];
                    return (
                      <SelectItem key={code} textValue={`${code} - ${statusInfo?.description}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{code}</span>
                          <span className="text-xs text-foreground-500">{statusInfo?.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </Select>
              </div>
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
              <Button color="danger" variant="bordered" onPress={handleCancel}>
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
