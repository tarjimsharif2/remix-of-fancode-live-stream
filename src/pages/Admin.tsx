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
import { Globe, Plus, Trash2, LogOut, Shield, Edit, Server, Monitor, Key, Database, Save, RefreshCw } from "lucide-react";

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
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<DomainType>('embed');
  const [dataSourceUrl, setDataSourceUrl] = useState("");
  const [originalDataSourceUrl, setOriginalDataSourceUrl] = useState("");
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [crichdDataSourceUrl, setCrichdDataSourceUrl] = useState("");
  const [originalCrichdDataSourceUrl, setOriginalCrichdDataSourceUrl] = useState("");
  const [isSavingCrichdUrl, setIsSavingCrichdUrl] = useState(false);
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
        fetchDataSourceUrl();
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

  const fetchDataSourceUrl = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "data_source_url")
      .single();

    if (!error && data) {
      setDataSourceUrl(data.value);
      setOriginalDataSourceUrl(data.value);
    }

    // Fetch CricHd data source URL
    const { data: crichdData, error: crichdError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "crichd_data_source_url")
      .single();

    if (!crichdError && crichdData) {
      setCrichdDataSourceUrl(crichdData.value);
      setOriginalCrichdDataSourceUrl(crichdData.value);
    }
  };

  const handleSaveDataSourceUrl = async () => {
    const trimmedUrl = dataSourceUrl.trim();
    
    if (!trimmedUrl) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    try {
      new URL(trimmedUrl);
    } catch {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsSavingUrl(true);

    const { error } = await supabase
      .from("app_settings")
      .update({ value: trimmedUrl })
      .eq("key", "data_source_url");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save data source URL",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Data source URL updated successfully",
      });
      setOriginalDataSourceUrl(trimmedUrl);
    }

    setIsSavingUrl(false);
  };

  const handleSaveCrichdDataSourceUrl = async () => {
    const trimmedUrl = crichdDataSourceUrl.trim();
    
    if (!trimmedUrl) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsSavingCrichdUrl(true);

    const { error } = await supabase
      .from("app_settings")
      .update({ value: trimmedUrl })
      .eq("key", "crichd_data_source_url");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save CricHd data source URL",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "CricHd data source URL updated successfully",
      });
      setOriginalCrichdDataSourceUrl(trimmedUrl);
    }

    setIsSavingCrichdUrl(false);
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

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setIsChangingPassword(false);
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
          <div className="flex items-center gap-2">
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your new password below
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isChangingPassword}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} disabled={isChangingPassword}>
                    Cancel
                  </Button>
                  <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
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

        {/* Data Source Settings */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Source Settings
            </CardTitle>
            <CardDescription>
              Configure the GitHub JSON URLs for fetching data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* FanCode Data Source */}
              <div className="space-y-2">
                <Label htmlFor="data-source-url">FanCode JSON URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="data-source-url"
                    placeholder="https://raw.githubusercontent.com/..."
                    value={dataSourceUrl}
                    onChange={(e) => setDataSourceUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveDataSourceUrl}
                    disabled={isSavingUrl || dataSourceUrl === originalDataSourceUrl}
                  >
                    {isSavingUrl ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Save</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The edge function will fetch FanCode match data from this URL.
                </p>
              </div>

              {/* CricHd Data Source */}
              <div className="space-y-2">
                <Label htmlFor="crichd-data-source-url">CricHd JSON URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="crichd-data-source-url"
                    placeholder="https://raw.githubusercontent.com/..."
                    value={crichdDataSourceUrl}
                    onChange={(e) => setCrichdDataSourceUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveCrichdDataSourceUrl}
                    disabled={isSavingCrichdUrl || crichdDataSourceUrl === originalCrichdDataSourceUrl}
                  >
                    {isSavingCrichdUrl ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Save</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The edge function will fetch CricHd channel data from this URL.
                </p>
              </div>
            </div>
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
