import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { M3uPlaylist } from '@/types/m3uPlaylist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ExternalLink, Copy } from 'lucide-react';

interface PlaylistForm {
  name: string;
  slug: string;
  url: string;
  description: string;
  logo_url: string;
  display_order: number;
}

const defaultForm: PlaylistForm = {
  name: '',
  slug: '',
  url: '',
  description: '',
  logo_url: '',
  display_order: 0,
};

export function M3uPlaylistManager() {
  const [playlists, setPlaylists] = useState<M3uPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlaylistForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('m3u_playlists')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setPlaylists((data || []) as M3uPlaylist[]);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      toast.error('Failed to fetch playlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleOpenDialog = (playlist?: M3uPlaylist) => {
    if (playlist) {
      setEditingId(playlist.id);
      setForm({
        name: playlist.name,
        slug: playlist.slug,
        url: playlist.url,
        description: playlist.description || '',
        logo_url: playlist.logo_url || '',
        display_order: playlist.display_order || 0,
      });
    } else {
      setEditingId(null);
      setForm(defaultForm);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: editingId ? prev.slug : generateSlug(name),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.url.trim()) {
      toast.error('Name, slug, and URL are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        url: form.url.trim(),
        description: form.description.trim() || null,
        logo_url: form.logo_url.trim() || null,
        display_order: form.display_order,
      };

      if (editingId) {
        const { error } = await supabase
          .from('m3u_playlists')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Playlist updated');
      } else {
        const { error } = await supabase
          .from('m3u_playlists')
          .insert(payload);

        if (error) throw error;
        toast.success('Playlist added');
      }

      handleCloseDialog();
      fetchPlaylists();
    } catch (err: any) {
      console.error('Error saving playlist:', err);
      if (err.code === '23505') {
        toast.error('A playlist with this slug already exists');
      } else {
        toast.error('Failed to save playlist');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (playlist: M3uPlaylist) => {
    try {
      const { error } = await supabase
        .from('m3u_playlists')
        .update({ is_active: !playlist.is_active })
        .eq('id', playlist.id);

      if (error) throw error;
      toast.success(`Playlist ${playlist.is_active ? 'deactivated' : 'activated'}`);
      fetchPlaylists();
    } catch (err) {
      console.error('Error toggling playlist:', err);
      toast.error('Failed to update playlist');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const { error } = await supabase
        .from('m3u_playlists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Playlist deleted');
      fetchPlaylists();
    } catch (err) {
      console.error('Error deleting playlist:', err);
      toast.error('Failed to delete playlist');
    }
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/playlist/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">M3U Playlists</h2>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Playlist
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playlists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No playlists added yet
                  </TableCell>
                </TableRow>
              ) : (
                playlists.map((playlist) => (
                  <TableRow key={playlist.id}>
                    <TableCell className="font-medium">{playlist.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">/playlist/{playlist.slug}</code>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <a
                        href={playlist.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{playlist.url}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>{playlist.display_order}</TableCell>
                    <TableCell>
                      <Switch
                        checked={playlist.is_active}
                        onCheckedChange={() => handleToggleActive(playlist)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyUrl(playlist.slug)}
                          title="Copy URL"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(playlist)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(playlist.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Playlist' : 'Add New Playlist'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="BDIX Channels"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="bdix"
              />
              <p className="text-xs text-muted-foreground">
                URL will be: /playlist/{form.slug || 'your-slug'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">M3U URL *</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/playlist.m3u"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={form.logo_url}
                onChange={(e) => setForm(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={form.display_order}
                onChange={(e) => setForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
