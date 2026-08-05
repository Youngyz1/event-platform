import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Body/label/metadata scale, shared across surfaces. Replaces ad hoc
 * `text-sm text-zinc-500` style repetition.
 */
const textVariants = cva("", {
  variants: {
    variant: {
      body: "text-sm text-foreground sm:text-base",
      muted: "text-sm text-muted-foreground",
      label: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
      caption: "text-xs text-muted-foreground",
      helper: "text-xs text-muted-foreground",
      error: "text-xs text-destructive",
    },
  },
  defaultVariants: { variant: "body" },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div";
}

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, variant, as = "p", ...props }, ref) => {
    const Comp = as;
    return (
      <Comp
        ref={ref as React.Ref<HTMLParagraphElement>}
        className={cn(textVariants({ variant, className }))}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Text, textVariants };
