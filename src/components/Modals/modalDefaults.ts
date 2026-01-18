export const modalHeaderClass = "flex flex-col gap-1 p-8 pb-0";
export const modalBodyClass = "gap-4 px-8 py-4";
export const modalFooterClass = "gap-4 p-8 pt-4";

export const modalInputProps = {
  size: "md" as const,
  labelPlacement: "outside" as const,
  variant: "bordered" as const,
};

export const modalCancelButtonProps = {
  color: "default" as const,
  variant: "bordered" as const,
  size: "md" as const,
};

export const modalPrimaryButtonProps = {
  color: "primary" as const,
  size: "md" as const,
};
