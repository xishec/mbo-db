import type { MouseEvent } from "react";

export const stopModalPropagation = (event: MouseEvent) => {
  event.stopPropagation();
};
