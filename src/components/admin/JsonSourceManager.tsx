import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, ExternalLink, GripVertical, Play, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJsonSources } from "@/hooks/useJsonSources";
import { PLAYER_CONFIGS, PlayerType } from "@/types/playerTypes";
import { LinkConfig } from "@/types/jsonSource";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface EditingLinkConfig {
  position: number;
  prefix: string;
  player: PlayerType | '';
}

export const JsonSourceManager = () => {
  const { sources, loading, addSource, updateSource, deleteSource, refetch } = useJsonSources();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedPrefixId, setExpandedPrefixId] = useState<string | null>(null);
  const [editingPrefixes, setEditingPrefixes] = useState<EditingLinkConfig[]>([]);
  
  const [newSource, setNewSource] = useState({
    name: "",
    slug: "",
    url: "",
    description: "",
    is_active: true,
    default_player: "clappr" as PlayerType,
  });
  
  const [editSource, setEditSource] = useState({
    name: "",
    slug: "",
    url: "",
    description: "",
    default_player: "clappr" as PlayerType,
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
      setNewSource({ name: "", slug: "", url: "", description: "", is_active: true, default_player: "clappr" });
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

  const handleSourcePlayerChange = async (id: string, player: PlayerType) => {
    try {
      await updateSource(id, { default_player: player });
      toast.success("Player updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update player");
    }
  };

  const startEdit = (source: any) => {
    setEditingId(source.id);
    setEditSource({
      name: source.name,
      slug: source.slug,
      url: source.url,
      description: source.description || "",
      default_player: source.default_player || "clappr",
    });
  };

  const getPlayerLabel = (type: PlayerType) => {
    const config = PLAYER_CONFIGS.find(c => c.type === type);
    return config ? `${config.icon} ${config.label}` : type;
  };

  // Link Config Management (prefix + player per link)
  const togglePrefixExpand = (sourceId: string, currentPrefixes: Record<string, unknown> | null) => {
    if (expandedPrefixId === sourceId) {
      setExpandedPrefixId(null);
      setEditingPrefixes([]);
    } else {
      setExpandedPrefixId(sourceId);
      // Convert object to array, handling both legacy string and new LinkConfig format
      const prefixArray: EditingLinkConfig[] = currentPrefixes
        ? Object.entries(currentPrefixes).map(([pos, config]): EditingLinkConfig => {
            if (typeof config === 'string') {
              // Legacy format: just prefix string
              return { position: parseInt(pos, 10), prefix: config, player: '' };
            }
            // New format: LinkConfig object
            const obj = config as Record<string, unknown>;
            return {
              position: parseInt(pos, 10),
              prefix: (typeof obj?.prefix === 'string' ? obj.prefix : '') || '',
              player: ((typeof obj?.player === 'string' ? obj.player : '') || '') as PlayerType | '',
            };
          }).sort((a, b) => a.position - b.position)
        : [];
      setEditingPrefixes(prefixArray);
    }
  };

  const handleAddPrefixEntry = () => {
    const nextPos = editingPrefixes.length > 0
      ? Math.max(...editingPrefixes.map(p => p.position)) + 1
      : 1;
    setEditingPrefixes([...editingPrefixes, { position: nextPos, prefix: '', player: '' }]);
  };

  const handleRemovePrefixEntry = (position: number) => {
    setEditingPrefixes(editingPrefixes.filter(p => p.position !== position));
  };

  const handlePrefixChange = (position: number, newPrefix: string) => {
    setEditingPrefixes(editingPrefixes.map(p =>
      p.position === position ? { ...p, prefix: newPrefix } : p
    ));
  };

  const handleLinkPlayerChange = (position: number, newPlayer: PlayerType | '') => {
    setEditingPrefixes(editingPrefixes.map(p =>
      p.position === position ? { ...p, player: newPlayer } : p
    ));
  };

  const handlePrefixPositionChange = (oldPos: number, newPos: number) => {
    if (newPos < 1) return;
    setEditingPrefixes(editingPrefixes.map(p =>
      p.position === oldPos ? { ...p, position: newPos } : p
    ));
  };

  const handleSavePrefixes = async (sourceId: string) => {
    try {
      // Convert array to new LinkConfig object format
      const configObj: Record<string, LinkConfig> = {};
      editingPrefixes.forEach(p => {
        // Only add if there's a prefix OR player set
        if (p.prefix.trim() || p.player) {
          configObj[p.position.toString()] = {
            ...(p.prefix.trim() && { prefix: p.prefix.trim() }),
            ...(p.player && { player: p.player as PlayerType }),
          };
        }
      });

      await updateSource(sourceId, { link_prefixes: configObj });
      toast.success("Link settings saved");
      setExpandedPrefixId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const getLinkConfigCount = (prefixes: Record<string, string | LinkConfig> | null) => {
    if (!prefixes) return 0;
    return Object.keys(prefixes).length;
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={newSource.description}
                  onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Default Player
                </Label>
                <Select
                  value={newSource.default_player}
                  onValueChange={(value) => setNewSource({ ...newSource, default_player: value as PlayerType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_CONFIGS.map((config) => (
                      <SelectItem key={config.type} value={config.type}>
                        <span className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  setNewSource({ name: "", slug: "", url: "", description: "", is_active: true, default_player: "clappr" });
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
          {sources.map((source: any) => (
            <div
              key={source.id}
              className="p-4 border rounded-lg flex flex-col gap-4"
            >
              {editingId === source.id ? (
                <div className="space-y-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={editSource.description}
                      onChange={(e) => setEditSource({ ...editSource, description: e.target.value })}
                      placeholder="Description"
                    />
                    <Select
                      value={editSource.default_player}
                      onValueChange={(value) => setEditSource({ ...editSource, default_player: value as PlayerType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAYER_CONFIGS.map((config) => (
                          <SelectItem key={config.type} value={config.type}>
                            <span className="flex items-center gap-2">
                              <span>{config.icon}</span>
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{source.name}</h4>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          /{source.slug}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getPlayerLabel(source.default_player || 'clappr')}
                        </Badge>
                        {getLinkConfigCount(source.link_prefixes) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Link2 className="w-3 h-3 mr-1" />
                            {getLinkConfigCount(source.link_prefixes)} link config
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{source.url}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Link Prefix Toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => togglePrefixExpand(source.id, source.link_prefixes)}
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        Prefix
                        {expandedPrefixId === source.id ? (
                          <ChevronUp className="w-3 h-3 ml-1" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-1" />
                        )}
                      </Button>

                      {/* Quick Player Selector */}
                      <Select
                        value={source.default_player || 'clappr'}
                        onValueChange={(value) => handleSourcePlayerChange(source.id, value as PlayerType)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAYER_CONFIGS.map((config) => (
                            <SelectItem key={config.type} value={config.type}>
                              {config.icon} {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
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
                  </div>

                  {/* Collapsible Link Settings (Prefix + Player) */}
                  {expandedPrefixId === source.id && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        <Label className="font-medium">Per-Link Settings</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configure proxy prefix and player type for each link position (1, 2, 3...).
                      </p>

                      {editingPrefixes.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No link settings configured.</p>
                      ) : (
                        <div className="space-y-3">
                          {editingPrefixes.map((p) => (
                            <div key={p.position} className="flex flex-col md:flex-row md:items-center gap-2 p-2 bg-background/50 rounded border">
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground font-medium">Link</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={p.position}
                                  onChange={(e) => handlePrefixPositionChange(p.position, parseInt(e.target.value, 10) || 1)}
                                  className="w-14 h-8 text-center text-xs"
                                />
                              </div>
                              <div className="flex-1 flex flex-col md:flex-row gap-2">
                                <Input
                                  placeholder="Proxy prefix (optional)"
                                  value={p.prefix}
                                  onChange={(e) => handlePrefixChange(p.position, e.target.value)}
                                  className="flex-1 h-8 text-xs"
                                />
                                <Select
                                  value={p.player || 'default'}
                                  onValueChange={(v) => handleLinkPlayerChange(p.position, v === 'default' ? '' : v as PlayerType)}
                                >
                                  <SelectTrigger className="w-full md:w-32 h-8 text-xs">
                                    <SelectValue placeholder="Player" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="default">
                                      <span className="text-muted-foreground">Default</span>
                                    </SelectItem>
                                    {PLAYER_CONFIGS.map((config) => (
                                      <SelectItem key={config.type} value={config.type}>
                                        {config.icon} {config.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive shrink-0"
                                onClick={() => handleRemovePrefixEntry(p.position)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={handleAddPrefixEntry}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add Link
                        </Button>
                        <Button size="sm" onClick={() => handleSavePrefixes(source.id)}>
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedPrefixId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
