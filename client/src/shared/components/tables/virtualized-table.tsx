import { useRef, useEffect, CSSProperties, forwardRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { cn } from '@/shared/lib/utils/utils';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

interface VirtualizedTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    accessor?: (item: T) => React.ReactNode;
    width?: number;
    className?: string;
  }[];
  rowHeight?: number;
  height?: number;
  width?: number | string;
  isLoading?: boolean;
  hasMore?: boolean;
  loadMore?: () => Promise<void>;
  onRowClick?: (item: T, index: number) => void;
  onRowHover?: (item: T, index: number) => void;
  className?: string;
  emptyMessage?: string;
  estimatedItemSize?: number;
  overscan?: number;
  testId?: string;
}

// Row component with accessibility and performance optimizations
const Row = forwardRef<HTMLDivElement, {
  index: number;
  style: CSSProperties;
  data: {
    items: any[];
    columns: any[];
    onRowClick?: (item: any, index: number) => void;
    onRowHover?: (item: any, index: number) => void;
  };
}>(({ index, style, data }, ref) => {
  const { items, columns, onRowClick, onRowHover } = data;
  const item = items[index];
  
  if (!item) {
    return (
      <div style={style} className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      ref={ref}
      style={style}
      className={cn(
        "flex border-b transition-colors",
        onRowClick && "cursor-pointer hover-elevate"
      )}
      onClick={() => onRowClick?.(item, index)}
      onMouseEnter={() => onRowHover?.(item, index)}
      data-testid={`virtual-row-${index}`}
      role="row"
      tabIndex={onRowClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onRowClick(item, index);
        }
      }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn(
            "px-4 py-2 flex items-center",
            column.className
          )}
          style={{
            width: column.width || `${100 / columns.length}%`,
            minWidth: column.width,
          }}
          role="cell"
        >
          {column.accessor ? column.accessor(item) : item[column.key]}
        </div>
      ))}
    </div>
  );
});

Row.displayName = 'VirtualizedTableRow';

export function VirtualizedTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 48,
  height = 600,
  width = '100%',
  isLoading = false,
  hasMore = false,
  loadMore,
  onRowClick,
  onRowHover,
  className,
  emptyMessage = 'No data available',
  estimatedItemSize = 48,
  overscan = 5,
  testId = 'virtualized-table',
}: VirtualizedTableProps<T>) {
  const listRef = useRef<List>(null);
  const sizeMap = useRef<{ [key: number]: number }>({});
  
  // Reset scroll position when data changes significantly
  useEffect(() => {
    if (listRef.current && data.length > 0) {
      listRef.current.scrollToItem(0, 'start');
    }
  }, [data.length]);

  const getItemSize = (index: number) => {
    return sizeMap.current[index] || estimatedItemSize;
  };

  const setItemSize = (index: number, size: number) => {
    sizeMap.current[index] = size;
    if (listRef.current) {
      listRef.current.resetAfterIndex(index);
    }
  };

  // Infinite loading configuration
  const itemCount = hasMore ? data.length + 1 : data.length;
  const isItemLoaded = (index: number) => !hasMore || index < data.length;
  
  const loadMoreItems = async () => {
    if (loadMore && !isLoading) {
      await loadMore();
    }
  };

  if (data.length === 0 && !isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const itemData = {
    items: data,
    columns,
    onRowClick,
    onRowHover,
  };

  return (
    <div className={cn("w-full", className)} data-testid={testId}>
      {/* Header */}
      <div className="border-b bg-muted/50 sticky top-0 z-10">
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                "px-4 py-3 font-medium text-sm",
                column.className
              )}
              style={{
                width: column.width || `${100 / columns.length}%`,
                minWidth: column.width,
              }}
              role="columnheader"
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual list */}
      {loadMore && hasMore ? (
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={(list) => {
                // @ts-ignore - react-window types issue
                ref(list);
                // @ts-ignore
                listRef.current = list;
              }}
              height={height}
              width={width}
              itemCount={itemCount}
              itemSize={getItemSize}
              itemData={itemData}
              overscanCount={overscan}
              onItemsRendered={onItemsRendered}
              className="scrollbar-thin"
            >
              {Row}
            </List>
          )}
        </InfiniteLoader>
      ) : (
        <List
          ref={listRef}
          height={height}
          width={width}
          itemCount={data.length}
          itemSize={getItemSize}
          itemData={itemData}
          overscanCount={overscan}
          className="scrollbar-thin"
        >
          {Row}
        </List>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center p-4 border-t">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading more...</span>
        </div>
      )}
    </div>
  );
}

// Fixed height variant for consistent layouts
export function FixedVirtualizedTable<T extends Record<string, any>>(
  props: Omit<VirtualizedTableProps<T>, 'height'>
) {
  return <VirtualizedTable {...props} height={600} />;
}

// Full height variant that fills parent container
export function FullHeightVirtualizedTable<T extends Record<string, any>>(
  props: Omit<VirtualizedTableProps<T>, 'height' | 'width'>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ height: 600, width: '100%' });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          height: rect.height || 600,
          width: rect.width || '100%',
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <VirtualizedTable {...props} height={dimensions.height} width={dimensions.width} />
    </div>
  );
}