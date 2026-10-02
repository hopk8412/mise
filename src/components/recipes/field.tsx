import { Label } from "@/components/ui/label";

type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FieldProps = {
  id: string;
  label: string;
  errors?: string[];
  hint?: string;
  children: (control: ControlProps) => React.ReactNode;
};

/** A labelled control with an optional hint and its first error, wired up with aria attributes. */
export function Field({ id, label, errors, hint, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": errorId ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="text-destructive text-xs">
          {errors![0]}
        </p>
      ) : null}
    </div>
  );
}
