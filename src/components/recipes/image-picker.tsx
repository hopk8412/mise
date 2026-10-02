"use client";

import { ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECIPE_IMAGE_MAX_BYTES, RECIPE_IMAGE_TYPES } from "@/lib/validation/recipe";

const MAX_MB = RECIPE_IMAGE_MAX_BYTES / (1024 * 1024);

type ImagePickerProps = {
  id: string;
  /** Address of the image the recipe has now, when editing. */
  currentUrl?: string | null;
  removeCurrent: boolean;
  onRemoveCurrentChange: (remove: boolean) => void;
  onFileChange: (file: File | null) => void;
  errors?: string[];
};

export function ImagePicker({
  id,
  currentUrl,
  removeCurrent,
  onRemoveCurrentChange,
  onFileChange,
  errors,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ name: string; url: string }>();
  const [localError, setLocalError] = useState<string>();
  // Mirrors `selected` so unmounting can release the preview without a stale closure.
  const urlRef = useRef<string>(undefined);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function replacePreview(next?: { name: string; url: string }) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next?.url;
    setSelected(next);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      // The picker was cancelled or cleared: nothing is selected any more.
      replacePreview(undefined);
      setLocalError(undefined);
      onFileChange(null);
      return;
    }

    let problem: string | undefined;
    if (!(RECIPE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      problem = "Choose a JPEG, PNG or WebP image.";
    } else if (file.size > RECIPE_IMAGE_MAX_BYTES) {
      problem = `Choose an image no larger than ${MAX_MB} MB.`;
    }

    if (problem) {
      event.target.value = "";
      replacePreview(undefined);
      setLocalError(problem);
      onFileChange(null);
      return;
    }

    setLocalError(undefined);
    replacePreview({ name: file.name, url: URL.createObjectURL(file) });
    onFileChange(file);
  }

  function clearSelection() {
    if (inputRef.current) inputRef.current.value = "";
    replacePreview(undefined);
    setLocalError(undefined);
    onFileChange(null);
    inputRef.current?.focus();
  }

  const message = localError ?? errors?.[0];
  const messageId = message ? `${id}-error` : undefined;
  const hintId = `${id}-hint`;
  const showCurrent = !selected && currentUrl;

  return (
    <div className="grid gap-3">
      <Label htmlFor={id} className="sr-only">
        Choose an image file
      </Label>

      {selected || showCurrent ? (
        <div className="grid gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or a stored upload, not an optimizable asset */}
          <img
            src={selected ? selected.url : currentUrl!}
            alt={selected ? "Preview of the selected image" : "Current image"}
            className={`aspect-video w-full max-w-sm rounded-lg border object-cover ${
              !selected && removeCurrent ? "opacity-40" : ""
            }`}
          />
          {selected ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground min-w-0 truncate">{selected.name}</span>
              <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
                <X aria-hidden="true" />
                Clear selection
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-muted-foreground bg-muted/40 flex aspect-video w-full max-w-sm items-center justify-center rounded-lg border border-dashed">
          <ImageIcon aria-hidden="true" className="size-8" />
          <span className="sr-only">No image selected</span>
        </div>
      )}

      <Input
        ref={inputRef}
        id={id}
        type="file"
        accept={RECIPE_IMAGE_TYPES.join(",")}
        onChange={handleChange}
        aria-invalid={messageId ? true : undefined}
        aria-describedby={[hintId, messageId].filter(Boolean).join(" ")}
        className="h-auto max-w-sm py-1.5"
      />
      <p id={hintId} className="text-muted-foreground text-xs">
        JPEG, PNG or WebP, up to {MAX_MB} MB.
        {currentUrl && selected ? " It replaces the current image when you save." : ""}
      </p>
      {messageId ? (
        <p id={messageId} className="text-destructive text-xs">
          {message}
        </p>
      ) : null}

      {currentUrl && !selected ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-remove`}
            checked={removeCurrent}
            onCheckedChange={(checked) => onRemoveCurrentChange(checked === true)}
          />
          <Label htmlFor={`${id}-remove`} className="font-normal">
            Remove the current image
          </Label>
        </div>
      ) : null}
    </div>
  );
}
