"use client";

import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteRecipeAction } from "@/lib/actions/recipes";

/**
 * Deleting asks for confirmation first. The form sits outside the dialog and the confirm
 * button points at it with the `form` attribute, so the submit still happens after the
 * dialog closes and unmounts its content.
 */
export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  const formId = `delete-recipe-${recipeId}`;

  return (
    <>
      <form id={formId} action={deleteRecipeAction.bind(null, recipeId)} className="hidden" />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            <Trash2 />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; and its ingredients, steps and tags will be removed. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep recipe</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId} variant="destructive">
              Delete recipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
