"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { cn } from "./utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const ResizablePanel = React.forwardRef<
  ImperativePanelHandle,
  React.ComponentProps<typeof ResizablePrimitive.Panel>
>(({ className, style, ...props }, ref) => (
  <ResizablePrimitive.Panel 
    ref={ref} 
    data-slot="resizable-panel" 
    className={cn("transition-[flex-grow,flex-shrink,flex-basis] duration-300 ease-out", className)}
    style={style}
    {...props} 
  />
));

function ResizableHandle({
  withHandle,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "focus-visible:ring-ring relative flex items-center justify-center focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVertical className="w-2.5 h-2.5" />
        </div>
      )}
      {children}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
