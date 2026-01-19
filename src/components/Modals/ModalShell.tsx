import type { ComponentProps, MouseEventHandler } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { stopModalPropagation } from "./modalInteractions";

type HeroModalProps = ComponentProps<typeof Modal>;
type HeroModalContentProps = ComponentProps<typeof ModalContent>;
type HeroModalHeaderProps = Omit<ComponentProps<typeof ModalHeader>, "className">;
type HeroModalBodyProps = Omit<ComponentProps<typeof ModalBody>, "className">;
type HeroModalFooterProps = Omit<ComponentProps<typeof ModalFooter>, "className">;

interface ModalShellProps {
  modalProps: Omit<HeroModalProps, "children">;
  contentProps?: Omit<HeroModalContentProps, "children">;
  children: HeroModalContentProps["children"];
}

const modalHeaderClass = "flex flex-col gap-1 p-8 pb-0";
const modalBodyClass = "gap-4 px-8 py-4";
const modalFooterClass = "gap-4 p-8 pt-4";

const wrapStopPropagation =
  <T extends Element>(handler?: MouseEventHandler<T>): MouseEventHandler<T> =>
  (event) => {
    handler?.(event);
    stopModalPropagation(event);
  };

export function ModalHeaderShell(props: HeroModalHeaderProps) {
  return <ModalHeader {...props} className={modalHeaderClass} />;
}

export function ModalBodyShell(props: HeroModalBodyProps) {
  return <ModalBody {...props} className={modalBodyClass} />;
}

export function ModalFooterShell(props: HeroModalFooterProps) {
  return <ModalFooter {...props} className={modalFooterClass} />;
}

export default function ModalShell({ modalProps, contentProps, children }: ModalShellProps) {
  return (
    <Modal {...modalProps} onClick={wrapStopPropagation(modalProps.onClick)}>
      <ModalContent {...contentProps} onClick={wrapStopPropagation(contentProps?.onClick)}>
        {children}
      </ModalContent>
    </Modal>
  );
}
