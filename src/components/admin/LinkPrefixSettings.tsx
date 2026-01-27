import { useState, useEffect } from "react";
import { Link2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkPrefix {
  position: number;
  prefix: string;
}

export const LinkPrefixSettings = () => {
  const [prefixes, setPrefixes] = useState<LinkPrefix[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPrefixes();
  }, []);

  const fetchPrefixes = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'json_link_prefixes')
        .maybeSingle();

      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          // Convert object to array format
          const prefixArray: LinkPrefix[] = Object.entries(parsed)
            .map(([pos, prefix]) => ({
              position: parseInt(pos, 10),
              prefix: prefix as string,
            }))
            .sort((a, b) => a.position - b.position);
          setPrefixes(prefixArray);
        } catch {
          setPrefixes([]);
        }
      }
    } catch (err) {
      console.error('Error fetching link prefixes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrefix = () => {
    const nextPosition = prefixes.length > 0 
      ? Math.max(...prefixes.map(p => p.position)) + 1 
      : 1;
    setPrefixes([...prefixes, { position: nextPosition, prefix: '' }]);
  };

  const handleRemovePrefix = (position: number) => {
    setPrefixes(prefixes.filter(p => p.position !== position));
  };

  const handlePositionChange = (oldPosition: number, newPosition: number) => {
    if (newPosition < 1) return;
    setPrefixes(prefixes.map(p => 
      p.position === oldPosition ? { ...p, position: newPosition } : p
    ));
  };

  const handlePrefixChange = (position: number, prefix: string) => {
    setPrefixes(prefixes.map(p => 
      p.position === position ? { ...p, prefix } : p
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert array to object format for storage
      const prefixObject: Record<string, string> = {};
      prefixes.forEach(p => {
        if (p.prefix.trim()) {
          prefixObject[p.position.toString()] = p.prefix.trim();
        }
      });

      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { 
            key: 'json_link_prefixes', 
            value: JSON.stringify(prefixObject), 
            description: 'Proxy prefix URLs for each link position in JSON sources' 
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast.success('Link prefixes saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save prefixes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link Proxy Prefixes
          </CardTitle>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Link Proxy Prefixes
        </CardTitle>
        <CardDescription>
          Set proxy URL prefix for each link position (1, 2, 3...). Stream URL will be appended.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prefix List */}
        <div className="space-y-3">
          {prefixes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No prefixes configured. Click "Add Link Prefix" to start.
            </p>
          ) : (
            prefixes.map((p) => (
              <div key={p.position} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium whitespace-nowrap">Link</Label>
                  <Input
                    type="number"
                    min={1}
                    value={p.position}
                    onChange={(e) => handlePositionChange(p.position, parseInt(e.target.value, 10) || 1)}
                    className="w-16 h-9 text-center"
                  />
                </div>
                <Input
                  placeholder="https://proxy.example.com/?url="
                  value={p.prefix}
                  onChange={(e) => handlePrefixChange(p.position, e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => handleRemovePrefix(p.position)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Example Preview */}
        {prefixes.some(p => p.prefix.trim()) && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <Label className="text-xs text-muted-foreground">Preview:</Label>
            {prefixes.filter(p => p.prefix.trim()).map(p => (
              <div key={p.position} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs">Link {p.position}</Badge>
                <code className="text-muted-foreground truncate">
                  {p.prefix}<span className="text-primary">[stream_url]</span>
                </code>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleAddPrefix}>
            <Plus className="w-4 h-4 mr-1" />
            Add Link Prefix
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Saving...' : 'Save Prefixes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
