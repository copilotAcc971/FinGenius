import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { queryClient } from '@/shared/lib/api/queryClient';
import { useTenant } from '@/shared/hooks/useTenant';
import { GripVertical, Plus, RotateCcw, Save } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/components/dashboard/dashboard-widgets';

interface DragglableWidgetProps {
  id: string;
  widgetType: string;
  title: string;
  data?: any;
  isLoading?: boolean;
}

function DraggableWidget({ id, widgetType, title, data, isLoading }: DragglableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const widgetConfig = WIDGET_REGISTRY[widgetType as keyof typeof WIDGET_REGISTRY];
  if (!widgetConfig) return null;

  const WidgetComponent = widgetConfig.component;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <WidgetComponent data={data} isLoading={isLoading} />
    </div>
  );
}

export default function CustomizableDashboardPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch dashboard widgets
  const { isLoading: isLoadingWidgets } = useQuery({
    queryKey: ['/api/dashboards/default', currentTenant?.id],
    queryFn: async () => {
      const response = await fetch('/api/dashboards/default');
      if (!response.ok) throw new Error('Failed to load dashboard');
      const data = await response.json();
      setWidgets(data.widgets || []);
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const saveDashboardMutation = useMutation({
    mutationFn: async (updatedWidgets: any[]) => {
      const response = await fetch('/api/dashboards/default', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updatedWidgets }),
      });
      if (!response.ok) throw new Error('Failed to save dashboard');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Dashboard saved', description: 'Your layout has been saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/default'] });
      setIsEditMode(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save dashboard', variant: 'destructive' });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);

    const newWidgets = arrayMove(widgets, oldIndex, newIndex);
    setWidgets(newWidgets);
  };

  const handleAddWidget = (widgetType: string) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      widgetType,
      title: WIDGET_REGISTRY[widgetType as keyof typeof WIDGET_REGISTRY]?.title || widgetType,
      position: widgets.length,
      isVisible: true,
    };
    setWidgets([...widgets, newWidget]);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter((w) => w.id !== widgetId));
  };

  const handleReset = () => {
    setWidgets([]);
    setIsEditMode(false);
  };

  const handleSave = () => {
    saveDashboardMutation.mutate(widgets);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Customize your dashboard with widgets</p>
        </div>
        <div className="flex gap-2">
          {isEditMode && (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-dashboard"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveDashboardMutation.isPending}
                data-testid="button-save-dashboard"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </Button>
            </>
          )}
          <Button
            variant={isEditMode ? 'default' : 'outline'}
            onClick={() => setIsEditMode(!isEditMode)}
            data-testid="button-edit-dashboard"
          >
            {isEditMode ? 'Done Editing' : 'Edit Dashboard'}
          </Button>
        </div>
      </div>

      {/* Edit Mode - Widget Selector */}
      {isEditMode && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Add Widgets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(WIDGET_REGISTRY).map(([key, config]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                onClick={() => handleAddWidget(key)}
                className="flex-col h-auto py-2"
                data-testid={`button-add-widget-${key}`}
              >
                <Plus className="h-4 w-4 mb-1" />
                <span className="text-xs text-center">{config.title}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Dashboard Grid */}
      {widgets.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={widgets.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
            disabled={!isEditMode}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => (
                <div key={widget.id} className="relative group">
                  <DraggableWidget
                    id={widget.id}
                    widgetType={widget.widgetType}
                    title={widget.title}
                    data={widget.data}
                    isLoading={isLoadingWidgets}
                  />
                  {isEditMode && (
                    <button
                      onClick={() => handleRemoveWidget(widget.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
                      data-testid={`button-remove-widget-${widget.id}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No widgets added yet</p>
          {isEditMode && (
            <p className="text-sm text-muted-foreground">Click "Add Widgets" above to get started</p>
          )}
        </Card>
      )}
    </div>
  );
}
