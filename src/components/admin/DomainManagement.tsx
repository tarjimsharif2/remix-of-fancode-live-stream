import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { Globe, Plus, Trash2, Edit, Server, Monitor, Shield } from "lucide-react";

interface AllowedDomain {
  id: string;
  domain: string;
  description: string | null;
  is_active: boolean;
  domain_type: 'embed' | 'api';
  created_at: string;
  updated_at: string;
}

interface ReferrerDomain {
  id: string;
  domain: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type DomainType = 'embed' | 'api' | 'referrer';

export const DomainManagement = () => {
  const [embedDomains, setEmbedDomains] = useState<AllowedDomain[]>([]);
  const [apiDomains, setApiDomains] = useState<AllowedDomain[]>([]);
  const [referrerDomains, setReferrerDomains] = useState<ReferrerDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingDomain, setEditingDomain] = useState<AllowedDomain | ReferrerDomain | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DomainType>('referrer');
  const { toast } = useToast();

  useEffect(() => {
    fetchDomains();
    fetchReferrerDomains();
  }, []);

  const fetchDomains = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("allowed_domains")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch domains", variant: "destructive" });
    } else {
      const allDomains = (data || []) as AllowedDomain[];
      setEmbedDomains(allDomains.filter(d => d.domain_type === 'embed'));
      setApiDomains(allDomains.filter(d => d.domain_type === 'api'));
    }
    setIsLoading(false);
  };

  const fetchReferrerDomains = async () => {
    const { data, error } = await supabase
      .from("referrer_domains")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch referrer domains", variant: "destructive" });
    } else {
      setReferrerDomains((data || []) as ReferrerDomain[]);
    }
  };

  const handleAddDomain = async () => {
    const trimmedDomain = newDomain.trim().toLowerCase();
    if (!trimmedDomain) {
      toast({ title: "Error", description: "Please enter a domain", variant: "destructive" });
      return;
    }

    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    if (!domainRegex.test(trimmedDomain)) {
      toast({ title: "Error", description: "Please enter a valid domain", variant: "destructive" });
      return;
    }

    if (activeTab === 'referrer') {
      const { error } = await supabase.from("referrer_domains").insert({
        domain: trimmedDomain,
        description: newDescription.trim() || null,
        is_active: true,
      });

      if (error) {
        toast({ title: "Error", description: error.code === "23505" ? "Domain already exists" : "Failed to add domain", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Domain added" });
        setNewDomain("");
        setNewDescription("");
        setIsAddDialogOpen(false);
        fetchReferrerDomains();
      }
      return;
    }

    const { error } = await supabase.from("allowed_domains").insert({
      domain: trimmedDomain,
      description: newDescription.trim() || null,
      is_active: true,
      domain_type: activeTab,
    });

    if (error) {
      toast({ title: "Error", description: error.code === "23505" ? "Domain already exists" : "Failed to add domain", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Domain added" });
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
      toast({ title: "Error", description: "Please enter a domain", variant: "destructive" });
      return;
    }

    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
    if (!domainRegex.test(trimmedDomain)) {
      toast({ title: "Error", description: "Please enter a valid domain", variant: "destructive" });
      return;
    }

    const tableName = activeTab === 'referrer' ? 'referrer_domains' : 'allowed_domains';
    const { error } = await supabase.from(tableName).update({
      domain: trimmedDomain,
      description: editDescription.trim() || null,
    }).eq("id", editingDomain.id);

    if (error) {
      toast({ title: "Error", description: error.code === "23505" ? "Domain already exists" : "Failed to update", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Domain updated" });
      setEditingDomain(null);
      setIsEditDialogOpen(false);
      activeTab === 'referrer' ? fetchReferrerDomains() : fetchDomains();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean, type: DomainType) => {
    const tableName = type === 'referrer' ? 'referrer_domains' : 'allowed_domains';
    const { error } = await supabase.from(tableName).update({ is_active: isActive }).eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } else {
      if (type === 'embed') {
        setEmbedDomains(embedDomains.map(d => d.id === id ? { ...d, is_active: isActive } : d));
      } else if (type === 'api') {
        setApiDomains(apiDomains.map(d => d.id === id ? { ...d, is_active: isActive } : d));
      } else {
        setReferrerDomains(referrerDomains.map(d => d.id === id ? { ...d, is_active: isActive } : d));
      }
      toast({ title: "Success", description: `Domain ${isActive ? "activated" : "deactivated"}` });
    }
  };

  const handleDeleteDomain = async (id: string, type: DomainType) => {
    const tableName = type === 'referrer' ? 'referrer_domains' : 'allowed_domains';
    const { error } = await supabase.from(tableName).delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete domain", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Domain deleted" });
      type === 'referrer' ? fetchReferrerDomains() : fetchDomains();
    }
  };

  const openEditDialog = (domain: AllowedDomain | ReferrerDomain) => {
    setEditingDomain(domain);
    setEditDomain(domain.domain);
    setEditDescription(domain.description || "");
    setIsEditDialogOpen(true);
  };

  const DomainTable = ({ domains, type }: { domains: (AllowedDomain | ReferrerDomain)[]; type: DomainType }) => (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : domains.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No domains added yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.domain}</TableCell>
                  <TableCell>
                    <Switch
                      checked={domain.is_active}
                      onCheckedChange={(checked) => handleToggleActive(domain.id, checked, type)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(domain)}>
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
                              Are you sure you want to delete "{domain.domain}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDomain(domain.id, type)}
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
                <DialogTitle>Add New Domain</DialogTitle>
                <DialogDescription>
                  Add a domain to the {activeTab} list
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
                    placeholder="Main site"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddDomain}>Add Domain</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DomainType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="referrer" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Referrer ({referrerDomains.length})
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Embed ({embedDomains.length})
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              API ({apiDomains.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="referrer">
            <p className="text-sm text-muted-foreground mb-4">
              Only users from these referrer domains can access the site.
            </p>
            <DomainTable domains={referrerDomains} type="referrer" />
          </TabsContent>

          <TabsContent value="embed">
            <p className="text-sm text-muted-foreground mb-4">
              Domains that can embed the video player in an iframe.
            </p>
            <DomainTable domains={embedDomains} type="embed" />
          </TabsContent>

          <TabsContent value="api">
            <p className="text-sm text-muted-foreground mb-4">
              Domains allowed to access the API endpoint.
            </p>
            <DomainTable domains={apiDomains} type="api" />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Domain</DialogTitle>
              <DialogDescription>Update the domain details</DialogDescription>
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
                  placeholder="Main site"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateDomain}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
