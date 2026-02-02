import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Youtube, RefreshCw, Play, ExternalLink } from "lucide-react";
import { YouTubeStream } from "@/types/youtubeStream";

export const YouTubeStreamManager = () => {
  const [streams, setStreams] = useState<YouTubeStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    youtube_url: "",
    logo_url: "",
    category: "general",
    is_active: true,
    display_order: 0,
  });

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("youtube_streams")
        .select("*")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setStreams((data || []) as YouTubeStream[]);
    } catch (err) {
      console.error("Error fetching streams:", err);
      toast.error("Failed to fetch YouTube streams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      youtube_url: "",
      logo_url: "",
      category: "general",
      is_active: true,
      display_order: 0,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.youtube_url.trim()) {
      toast.error("Name and YouTube URL are required");
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from("youtube_streams")
          .update({
            name: formData.name,
            youtube_url: formData.youtube_url,
            logo_url: formData.logo_url || null,
            category: formData.category,
            is_active: formData.is_active,
            display_order: formData.display_order,
            cached_m3u8: null, // Reset cache on URL change
            last_fetched_at: null,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Stream updated successfully");
      } else {
        const { error } = await supabase.from("youtube_streams").insert({
          name: formData.name,
          youtube_url: formData.youtube_url,
          logo_url: formData.logo_url || null,
          category: formData.category,
          is_active: formData.is_active,
          display_order: formData.display_order,
        });

        if (error) throw error;
        toast.success("Stream added successfully");
      }

      resetForm();
      fetchStreams();
    } catch (err) {
      console.error("Error saving stream:", err);
      toast.error("Failed to save stream");
    }
  };

  const handleEdit = (stream: YouTubeStream) => {
    setEditingId(stream.id);
    setFormData({
      name: stream.name,
      youtube_url: stream.youtube_url,
      logo_url: stream.logo_url || "",
      category: stream.category || "general",
      is_active: stream.is_active,
      display_order: stream.display_order || 0,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stream?")) return;

    try {
      const { error } = await supabase
        .from("youtube_streams")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Stream deleted successfully");
      fetchStreams();
    } catch (err) {
      console.error("Error deleting stream:", err);
      toast.error("Failed to delete stream");
    }
  };

  const handleTest = async (stream: YouTubeStream) => {
    setTestingId(stream.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-youtube-m3u8", {
        body: { 
          youtube_url: stream.youtube_url,
          stream_id: stream.id 
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`M3U8 extracted successfully!`, {
          description: `URL: ${data.m3u8_url?.substring(0, 50)}...`,
        });
        fetchStreams(); // Refresh to show updated cache
      } else {
        toast.error(data.error || "Failed to extract M3U8");
      }
    } catch (err) {
      console.error("Error testing stream:", err);
      toast.error("Failed to test stream extraction");
    } finally {
      setTestingId(null);
    }
  };

  const handleRefreshAll = async () => {
    toast.info("Refreshing all stream URLs...");
    
    for (const stream of streams.filter(s => s.is_active)) {
      try {
        await supabase.functions.invoke("fetch-youtube-m3u8", {
          body: { 
            youtube_url: stream.youtube_url,
            stream_id: stream.id 
          },
        });
      } catch (err) {
        console.error(`Failed to refresh ${stream.name}:`, err);
      }
    }

    toast.success("All streams refreshed");
    fetchStreams();
  };

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            {editingId ? "Edit YouTube Stream" : "Add YouTube Stream"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Channel Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Geo News Live"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="youtube_url">YouTube URL *</Label>
                <Input
                  id="youtube_url"
                  value={formData.youtube_url}
                  onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... or /live/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., news, sports, entertainment"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="gap-2">
                {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? "Update Stream" : "Add Stream"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Streams List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            YouTube Streams ({streams.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh All
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No YouTube streams added yet
            </p>
          ) : (
            <div className="space-y-3">
              {streams.map((stream) => (
                <div
                  key={stream.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border ${
                    stream.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {stream.logo_url ? (
                      <img
                        src={stream.logo_url}
                        alt={stream.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-red-500/20 flex items-center justify-center">
                        <Youtube className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{stream.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {stream.youtube_url}
                      </p>
                      {stream.cached_m3u8 && (
                        <p className="text-xs text-green-500 mt-0.5">
                          ✓ Cached {stream.last_fetched_at && `(${new Date(stream.last_fetched_at).toLocaleTimeString()})`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-2 py-1 rounded bg-muted">
                      {stream.category}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(stream)}
                      disabled={testingId === stream.id}
                      className="gap-1"
                    >
                      {testingId === stream.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Test
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(stream.youtube_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(stream)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(stream.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
