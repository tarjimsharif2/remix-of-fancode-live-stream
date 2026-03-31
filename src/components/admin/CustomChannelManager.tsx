import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAYER_CONFIGS } from "@/types/playerTypes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, Edit, Tv, Settings2 } from "lucide-react";
import { CustomChannel } from "@/types/customChannel";

interface ChannelForm {
  name: string;
  stream_url: string;
  logo_url: string;
  category: string;
  player_type: string;
  custom_referer: string;
  custom_origin: string;
  custom_user_agent: string;
  custom_cookie: string;
  custom_headers: string;
  display_order: number;
}

const defaultForm: ChannelForm = {
  name: "",
  stream_url: "",
  logo_url: "",
  category: "general",
  player_type: "clappr",
  custom_referer: "",
  custom_origin: "",
  custom_user_agent: "",
  custom_cookie: "",
  custom_headers: "{}",
  display_order: 0,
};

export function CustomChannelManager() {
  const [channels, setChannels] = useState<CustomChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CustomChannel | null>(null);
  const [form, setForm] = useState<ChannelForm>(defaultForm);
  const { toast } = useToast();

  const fetchChannels = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("custom_channels")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch channels",
        variant: "destructive",
      });
    } else {
      setChannels((data || []) as CustomChannel[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleOpenDialog = (channel?: CustomChannel) => {
    if (channel) {
      setEditingChannel(channel);
      setForm({
        name: channel.name,
        stream_url: channel.stream_url,
        logo_url: channel.logo_url || "",
        category: channel.category || "general",
        custom_referer: channel.custom_referer || "",
        custom_origin: channel.custom_origin || "",
        custom_user_agent: channel.custom_user_agent || "",
        custom_cookie: channel.custom_cookie || "",
        custom_headers: JSON.stringify(channel.custom_headers || {}, null, 2),
        display_order: channel.display_order || 0,
      });
    } else {
      setEditingChannel(null);
      setForm(defaultForm);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingChannel(null);
    setForm(defaultForm);
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return false;
    }
    if (!form.stream_url.trim()) {
      toast({ title: "Error", description: "Stream URL is required", variant: "destructive" });
      return false;
    }
    try {
      new URL(form.stream_url);
    } catch {
      toast({ title: "Error", description: "Invalid stream URL", variant: "destructive" });
      return false;
    }
    if (form.logo_url.trim()) {
      try {
        new URL(form.logo_url);
      } catch {
        toast({ title: "Error", description: "Invalid logo URL", variant: "destructive" });
        return false;
      }
    }
    try {
      JSON.parse(form.custom_headers);
    } catch {
      toast({ title: "Error", description: "Custom headers must be valid JSON", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const channelData = {
      name: form.name.trim(),
      stream_url: form.stream_url.trim(),
      logo_url: form.logo_url.trim() || null,
      category: form.category.trim() || "general",
      custom_referer: form.custom_referer.trim() || null,
      custom_origin: form.custom_origin.trim() || null,
      custom_user_agent: form.custom_user_agent.trim() || null,
      custom_cookie: form.custom_cookie.trim() || null,
      custom_headers: JSON.parse(form.custom_headers),
      display_order: form.display_order,
    };

    if (editingChannel) {
      const { error } = await supabase
        .from("custom_channels")
        .update(channelData)
        .eq("id", editingChannel.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update channel", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Channel updated successfully" });
        handleCloseDialog();
        fetchChannels();
      }
    } else {
      const { error } = await supabase
        .from("custom_channels")
        .insert(channelData);

      if (error) {
        toast({ title: "Error", description: "Failed to add channel", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Channel added successfully" });
        handleCloseDialog();
        fetchChannels();
      }
    }
  };

  const handleToggleActive = async (channel: CustomChannel) => {
    const { error } = await supabase
      .from("custom_channels")
      .update({ is_active: !channel.is_active })
      .eq("id", channel.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } else {
      setChannels(channels.map(c => 
        c.id === channel.id ? { ...c, is_active: !c.is_active } : c
      ));
      toast({ title: "Success", description: `Channel ${!channel.is_active ? "activated" : "deactivated"}` });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("custom_channels")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete channel", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Channel deleted" });
      fetchChannels();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">MyPlay Custom Channels</h3>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : channels.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No channels added yet
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Headers</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">{channel.name}</TableCell>
                  <TableCell className="capitalize">{channel.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {channel.custom_referer && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Referer</span>
                      )}
                      {channel.custom_origin && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Origin</span>
                      )}
                      {channel.custom_user_agent && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">UA</span>
                      )}
                      {channel.custom_cookie && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Cookie</span>
                      )}
                      {Object.keys(channel.custom_headers || {}).length > 0 && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                          +{Object.keys(channel.custom_headers).length}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={channel.is_active}
                      onCheckedChange={() => handleToggleActive(channel)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(channel)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{channel.name}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(channel.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "Edit Channel" : "Add New Channel"}
            </DialogTitle>
            <DialogDescription>
              Configure channel details and custom headers for stream proxy
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Channel Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Channel name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., sports, news, entertainment"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stream_url">Stream URL (M3U8) *</Label>
              <Input
                id="stream_url"
                value={form.stream_url}
                onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                placeholder="https://example.com/stream.m3u8"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Custom Headers Section */}
            <Accordion type="single" collapsible defaultValue="headers">
              <AccordionItem value="headers">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Custom Headers Configuration
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom_referer">Referer Header</Label>
                    <Input
                      id="custom_referer"
                      value={form.custom_referer}
                      onChange={(e) => setForm({ ...form, custom_referer: e.target.value })}
                      placeholder="https://source-site.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      The referring page URL. Required by many streaming sources.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_origin">Origin Header</Label>
                    <Input
                      id="custom_origin"
                      value={form.custom_origin}
                      onChange={(e) => setForm({ ...form, custom_origin: e.target.value })}
                      placeholder="https://source-site.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      The origin of the request. Usually the domain of the source site.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_user_agent">User-Agent Header</Label>
                    <Input
                      id="custom_user_agent"
                      value={form.custom_user_agent}
                      onChange={(e) => setForm({ ...form, custom_user_agent: e.target.value })}
                      placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom browser user-agent string if needed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_cookie">Cookie Header</Label>
                    <Input
                      id="custom_cookie"
                      value={form.custom_cookie}
                      onChange={(e) => setForm({ ...form, custom_cookie: e.target.value })}
                      placeholder="session=abc123; token=xyz789"
                    />
                    <p className="text-xs text-muted-foreground">
                      Session cookies if authentication is required.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom_headers">Additional Headers (JSON)</Label>
                    <Textarea
                      id="custom_headers"
                      value={form.custom_headers}
                      onChange={(e) => setForm({ ...form, custom_headers: e.target.value })}
                      placeholder='{"X-Custom-Header": "value"}'
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Any additional headers in JSON format.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingChannel ? "Update Channel" : "Add Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
