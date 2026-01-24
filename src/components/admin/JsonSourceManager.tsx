import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, ExternalLink, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJsonSources } from "@/hooks/useJsonSources";
import { toast } from "sonner";

export const JsonSourceManager = () => {
  const { sources, loading, addSource, updateSource, deleteSource, refetch } = useJsonSources();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newSource, setNewSource] = useState({
    name: "",
    slug: "",
    url: "",
    description: "",
    is_active: true,
  });
  
  const [editSource, setEditSource] = useState({
    name: "",
    slug: "",
    url: "",
    description: "",
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleAdd = async () => {
    if (!newSource.name || !newSource.url) {
      toast.error("Name and URL are required");
      return;
    }

    try {
      await addSource({
        ...newSource,
        slug: newSource.slug || generateSlug(newSource.name),
      });
      setNewSource({ name: "", slug: "", url: "", description: "", is_active: true });
      setIsAdding(false);
      toast.success("JSON source added successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to add source");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateSource(id, editSource);
      setEditingId(null);
      toast.success("Source updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update source");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteSource(id);
      toast.success("Source deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete source");
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      await updateSource(id, { is_active: !currentState });
      toast.success(`Source ${!currentState ? "activated" : "deactivated"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle source");
    }
  };

  const startEdit = (source: any) => {
    setEditingId(source.id);
    setEditSource({
      name: source.name,
      slug: source.slug,
      url: source.url,
      description: source.description || "",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>JSON Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>JSON Sources</CardTitle>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Source
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  placeholder="e.g., FanCode Live"
                  value={newSource.name}
                  onChange={(e) => {
                    setNewSource({
                      ...newSource,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL path)</Label>
                <Input
                  placeholder="e.g., fancode-live"
                  value={newSource.slug}
                  onChange={(e) => setNewSource({ ...newSource, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>JSON URL *</Label>
              <Input
                placeholder="https://example.com/matches.json"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={newSource.description}
                onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newSource.is_active}
                onCheckedChange={(checked) => setNewSource({ ...newSource, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm">
                <Check className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewSource({ name: "", slug: "", url: "", description: "", is_active: true });
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {sources.length === 0 && !isAdding && (
          <p className="text-center text-muted-foreground py-8">
            No JSON sources added yet. Click "Add Source" to get started.
          </p>
        )}

        <div className="space-y-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>

              {editingId === source.id ? (
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={editSource.name}
                      onChange={(e) => setEditSource({ ...editSource, name: e.target.value })}
                      placeholder="Name"
                    />
                    <Input
                      value={editSource.slug}
                      onChange={(e) => setEditSource({ ...editSource, slug: e.target.value })}
                      placeholder="Slug"
                    />
                  </div>
                  <Input
                    value={editSource.url}
                    onChange={(e) => setEditSource({ ...editSource, url: e.target.value })}
                    placeholder="URL"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(source.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{source.name}</h4>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        /{source.slug}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-md">{source.url}</p>
                    {source.description && (
                      <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={source.is_active}
                      onCheckedChange={() => handleToggleActive(source.id, source.is_active)}
                    />
                    <a
                      href={`/live/${source.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(source)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(source.id, source.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
