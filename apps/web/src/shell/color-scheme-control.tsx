import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  applyColorScheme,
  readColorScheme,
  storeColorScheme,
  type ColorScheme,
} from "./color-scheme.ts";

const options: { value: ColorScheme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

// The color scheme at the bottom of the menu (APR-1; ADR 0049): three
// options always in view, one tap to switch. Base UI's radio group gives
// the radiogroup and radio roles and moves between them with the arrow keys.
export function ColorSchemeControl() {
  const labelId = useId();
  const [choice, setChoice] = useState(readColorScheme);

  return (
    <div className="flex flex-col gap-2">
      <p
        id={labelId}
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Color scheme
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        value={choice}
        onValueChange={(value) => {
          setChoice(value);
          storeColorScheme(value);
          applyColorScheme(value);
        }}
        className="grid grid-cols-3 gap-1 rounded-control border border-border p-1"
      >
        {options.map(({ value, label, icon: Icon }) => (
          <Radio.Root
            key={value}
            value={value}
            className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[8px] text-xs font-semibold outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring data-checked:bg-accent data-checked:text-accent-foreground"
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  );
}
