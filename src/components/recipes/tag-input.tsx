"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECIPE_LIMITS } from "@/lib/validation/recipe";

/** The same normalization the recipe schema applies to a tag. */
export function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type TagInputProps = {
  id: string;
  tags: string[];
  draft: string;
  onTagsChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
  errors?: string[];
};

export function TagInput({ id, tags, draft, onTagsChange, onDraftChange, errors }: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string>();

  const hintId = `${id}-hint`;
  const message = notice ?? errors?.[0];
  const messageId = message ? `${id}-error` : undefined;

  /**
   * Adds each finished part as a tag. Stops at the first part that cannot be added and
   * leaves it, with everything after it, in the text box.
   */
  function commit(parts: string[], tail: string) {
    const next = [...tags];
    let problem: string | undefined;
    let leftover = tail;

    for (let i = 0; i < parts.length; i++) {
      const tag = normalizeTag(parts[i]);
      if (!tag || next.includes(tag)) continue;
      if (tag.length > RECIPE_LIMITS.tag) {
        problem = `Use ${RECIPE_LIMITS.tag} characters or fewer for each tag.`;
      } else if (next.length >= RECIPE_LIMITS.maxTags) {
        problem = `Use at most ${RECIPE_LIMITS.maxTags} tags.`;
      }
      if (problem) {
        leftover = [...parts.slice(i), tail].join(",");
        break;
      }
      next.push(tag);
    }

    setNotice(problem);
    if (next.length !== tags.length) onTagsChange(next);
    onDraftChange(leftover);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (!value.includes(",")) {
      setNotice(undefined);
      onDraftChange(value);
      return;
    }
    const parts = value.split(",");
    commit(parts.slice(0, -1), parts[parts.length - 1]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag; it never submits the recipe from here.
    if (event.key === "Enter") {
      event.preventDefault();
      commit([draft], "");
    }
  }

  function remove(tag: string) {
    setNotice(undefined);
    onTagsChange(tags.filter((existing) => existing !== tag));
    inputRef.current?.focus();
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="sr-only">
        Add tags
      </Label>
      {tags.length > 0 ? (
        <ul aria-label="Tags added" className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary" className="h-6 gap-1 overflow-visible pr-1 text-sm">
                {tag}
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="hover:bg-foreground/10 focus-visible:ring-ring/50 inline-flex size-4 items-center justify-center rounded-full outline-none focus-visible:ring-2"
                >
                  <X aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        aria-invalid={messageId ? true : undefined}
        aria-describedby={[hintId, messageId].filter(Boolean).join(" ")}
        placeholder="weeknight, vegetarian"
      />
      <p id={hintId} className="text-muted-foreground text-xs">
        Press Enter or type a comma to add a tag. Up to {RECIPE_LIMITS.maxTags} tags.
      </p>
      {messageId ? (
        <p id={messageId} className="text-destructive text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}
