import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  data: Record<string, any>;
}

interface TemplateSelectorProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  onSaveTemplate?: (data: Record<string, any>, name: string) => void;
  onDeleteTemplate?: (id: string) => void;
  currentData?: Record<string, any>;
  data_testid?: string;
}

export function TemplateSelector({
  templates,
  onSelect,
  onSaveTemplate,
  onDeleteTemplate,
  currentData,
  data_testid = "template-selector",
}: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [showSave, setShowSave] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const template = templates.find((t) => t.id === id);
    if (template) {
      onSelect(template);
    }
  };

  const handleSave = () => {
    if (templateName && currentData && onSaveTemplate) {
      onSaveTemplate(currentData, templateName);
      setTemplateName("");
      setShowSave(false);
    }
  };

  return (
    <div
      className="flex gap-2 items-center"
      data-testid={data_testid}
    >
      <Select value={selectedId} onValueChange={handleSelect}>
        <SelectTrigger className="w-48" data-testid="select-template">
          <SelectValue placeholder="Select a template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedId && onDeleteTemplate && (
        <Button
          size="icon"
          variant="outline"
          onClick={() => onDeleteTemplate(selectedId)}
          data-testid="button-delete-template"
          aria-label="Delete template"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {onSaveTemplate && (
        <>
          {showSave ? (
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="px-2 py-1 rounded border text-sm"
                data-testid="input-template-name"
              />
              <Button
                size="sm"
                onClick={handleSave}
                data-testid="button-confirm-template"
                aria-label="Save template"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSave(false)}
                data-testid="button-cancel-template"
                aria-label="Cancel saving template"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSave(true)}
              data-testid="button-save-template"
              aria-label="Save current form as template"
            >
              <Plus className="h-4 w-4 mr-1" />
              Save Template
            </Button>
          )}
        </>
      )}
    </div>
  );
}
