import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type RowControlsProps = {
  /** "ingredient" or "step", used in the button labels. */
  noun: string;
  /** Position in the list, starting at 0. */
  index: number;
  count: number;
  /** Identifies this row's buttons so focus can be put back after a move. */
  focusKey: string;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
};

export function RowControls({ noun, index, count, focusKey, onMove, onRemove }: RowControlsProps) {
  const number = index + 1;
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        data-focus-id={`${focusKey}-up`}
        aria-label={`Move ${noun} ${number} up`}
        disabled={index === 0}
        onClick={() => onMove("up")}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        data-focus-id={`${focusKey}-down`}
        aria-label={`Move ${noun} ${number} down`}
        disabled={index === count - 1}
        onClick={() => onMove("down")}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Remove ${noun} ${number}`}
        disabled={count === 1}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}
