import { useState, useCallback } from "react";

interface DragDropOptions {
  onDrop: (files: File[]) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  accept?: string[];
}

export function useDragDrop({
  onDrop,
  onDragEnter,
  onDragLeave,
  accept = [],
}: DragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      onDragEnter?.();
    },
    [onDragEnter]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      onDragLeave?.();
    },
    [onDragLeave]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);

      if (accept.length > 0) {
        const filtered = files.filter((file) =>
          accept.some(
            (type) =>
              file.type.startsWith(type) ||
              file.name.endsWith(type.split("/")[1] || "")
          )
        );
        onDrop(filtered);
      } else {
        onDrop(files);
      }
    },
    [onDrop, accept]
  );

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
