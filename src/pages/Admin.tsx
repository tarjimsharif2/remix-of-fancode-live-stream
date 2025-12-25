import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  DialogTrigger,
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
import { Globe, Plus, Trash2, LogOut, Shield, Edit, Server, Monitor } from "lucide-react";

interface AllowedDomain {
  id: string;
  domain: string;
  description: string | null;
  is_active: boolean;
  domain_type: 'embed' | 'api';
  created_at: string;
  updated_at: string;
}

type DomainType = 'embed' | 'api';

const Admin = () => {
  const [embedDomains, setEmbedDomains] = useState<AllowedDomain[]>([]);
  const [apiDomains, setApiDomains] = useState<AllowedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingDomain, setEditingDomain] = useState<AllowedDomain | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DomainType>('embed');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/admin/login");
      }
      setIsCheckingAuth(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/admin/login");
      } else {
        setIsCheckingAuth(false);
        fetchDomains();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchDomains = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("allowed_domains")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch domains",
        variant: "destructive",
      });
    } else {
      const allDomains = (data || []) as AllowedDomain[];
      setEmbedDomains(allDomains.filter(d => d.domain_type === 'embed'));
      setApiDomains(allDomains.filter(d => d.domain_type === 'api'));
    }
    setIsLoading(false);
  };

  const handleAddDomain = async () => {
    const trimmedDomain = newDomain.trim().toLowerCase();
    
    if (!trimmedDomain) {
      toast({
        title: "Error",
        description: "Please enter a domain",
        variant: "destructive",
      });
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    if (!domainRegex.test(trimmedDomain)) {
      toast({
        title: "Error",
        description: "Please enter a valid domain (e.g., example.com)",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("allowed_domains")
      .insert({
        domain: trimmedDomain,
        description: newDescription.trim() || null,
        is_active: true,
        domain_type: activeTab,
      });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Error",
          description: "This domain already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add domain",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Success",
        description: "Domain added successfully",
      });
      setNewDomain("");
      setNewDescription("");
      setIsAddDialogOpen(false);
      fetchDomains();
    }
  };

  const handleUpdateDomain = async () => {
    if (!editingDomain) return;

    const trimmedDomain = editDomain.trim().toLowerCase();
    
    if (!trimmedDomain) {
      toast({
        title: "Error",
        description: "Please enter a domain",
        variant: "destructive",
      });
      return;
    }

    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    if (!domainRegex.test(trimmedDomain)) {
      toast({
        title: "Error",
        description: "Please enter a valid domain",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("allowed_domains")
      .update({
        domain: trimmedDomain,
        description: editDescription.trim() || null,
      })
      .eq("id", editingDomain.id);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Error",
          description: "This domain already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update domain",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Success",
        description: "Domain updated successfully",
      });
      setEditingDomain(null);
      setIsEditDialogOpen(false);
      fetchDomains();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean, type: DomainType) => {
    const { error } = await supabase
      .from("allowed_domains")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update domain status",
        variant: "destructive",
      });
    } else {
      if (type === 'embed') {
        setEmbedDomains(embedDomains.map(d => d.id === id ? { ...d, is_active: isActive } : d));
      } else {
        setApiDomains(apiDomains.map(d => d.id === id ? { ...d, is_active: isActive } : d));
      }
      toast({
        title: "Success",
        description: `Domain ${isActive ? "activated" : "deactivated"}`,
      });
    }
  };

  const handleDeleteDomain = async (id: string) => {
    const { error } = await supabase
      .from("allowed_domains")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete domain",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Domain deleted successfully",
      });
      fetchDomains();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const openEditDialog = (domain: AllowedDomain) => {
    setEditingDomain(domain);
    setEditDomain(domain.domain);
    setEditDescription(domain.description || "");
    setIsEditDialogOpen(true);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentDomains = activeTab === 'embed' ? embedDomains : apiDomains;

  const DomainTable = ({ domains, type }: { domains: AllowedDomain[]; type: DomainType }) => (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : domains.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {type === 'embed' ? 'embed' : 'API'} domains added yet. Click "Add Domain" to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.domain}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {domain.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={domain.is_active}
                      onCheckedChange={(checked) => handleToggleActive(domain.id, checked, type)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(domain)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Domain</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{domain.domain}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDomain(domain.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
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
    </>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-full p-2">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground text-sm">Manage allowed domains</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Domain Management
                </CardTitle>
                <CardDescription>
                  Control which domains can embed the player and access the API
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New {activeTab === 'embed' ? 'Embed' : 'API'} Domain</DialogTitle>
                    <DialogDescription>
                      {activeTab === 'embed' 
                        ? 'Add a domain that can embed the video player'
                        : 'Add a domain that can access the fetch-matches API'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        placeholder="example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input
                        id="description"
                        placeholder="Main streaming site"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddDomain}>Add Domain</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DomainType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="embed" className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Embed Domains ({embedDomains.length})
                </TabsTrigger>
                <TabsTrigger value="api" className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  API Origins ({apiDomains.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="embed">
                <p className="text-sm text-muted-foreground mb-4">
                  Domains that can embed the video player in an iframe.
                </p>
                <DomainTable domains={embedDomains} type="embed" />
              </TabsContent>
              
              <TabsContent value="api">
                <p className="text-sm text-muted-foreground mb-4">
                  Domains allowed to access the fetch-matches API endpoint.
                </p>
                <DomainTable domains={apiDomains} type="api" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Domain</DialogTitle>
              <DialogDescription>
                Update the domain details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-domain">Domain</Label>
                <Input
                  id="edit-domain"
                  placeholder="example.com"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Input
                  id="edit-description"
                  placeholder="Main streaming site"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDomain}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
