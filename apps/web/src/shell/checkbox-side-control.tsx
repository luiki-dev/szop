import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";
import {
  storeCheckboxSide,
  useCheckboxSide,
  type CheckboxSide,
} from "./checkbox-side.ts";

// A small picture of a row: a circle (the checkbox) and a line (the name).
function RowPicture({ side }: { side: CheckboxSide }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-10 items-center gap-1 ${side === "right" ? "flex-row-reverse" : ""}`}
    >
      <span className="size-3 shrink-0 rounded-full border-2 border-current" />
      <span className="h-1 flex-1 rounded-full bg-current opacity-50" />
    </span>
  );
}

const options: { value: CheckboxSide; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

// The checkboxes' side under the color scheme (APR-2): the same radio group.
export function CheckboxSideControl() {
  const labelId = useId();
  const side = useCheckboxSide();

  return (
    <div className="flex flex-col gap-2">
      <p
        id={labelId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Checkboxes
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        value={side}
        onValueChange={storeCheckboxSide}
        className="grid grid-cols-2 gap-1 rounded-control border border-border p-1"
      >
        {options.map(({ value, label }) => (
          <Radio.Root
            key={value}
            value={value}
            className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[8px] text-xs font-semibold outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring data-checked:bg-accent data-checked:text-accent-foreground"
          >
            <RowPicture side={value} />
            {label}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  );
}
