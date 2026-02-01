import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw, Globe, Lock, Database } from "lucide-react";
import { PlayerSettings } from "./PlayerSettings";
import { LinkPrefixSettings } from "./LinkPrefixSettings";

export const SettingsTab = () => {
  const { toast } = useToast();
  
  // Data Source URLs
  const [dataSourceUrl, setDataSourceUrl] = useState("");
  const [originalDataSourceUrl, setOriginalDataSourceUrl] = useState("");
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [crichdDataSourceUrl, setCrichdDataSourceUrl] = useState("");
  const [originalCrichdDataSourceUrl, setOriginalCrichdDataSourceUrl] = useState("");
  const [isSavingCrichdUrl, setIsSavingCrichdUrl] = useState(false);

  // Worldwide proxy settings
  const [worldwideProxyUrl, setWorldwideProxyUrl] = useState("");
  const [originalWorldwideProxyUrl, setOriginalWorldwideProxyUrl] = useState("");
  const [worldwideBaseServer, setWorldwideBaseServer] = useState<'BD' | 'IN'>('BD');
  const [originalWorldwideBaseServer, setOriginalWorldwideBaseServer] = useState<'BD' | 'IN'>('BD');
  const [worldwideWrapperUrl, setWorldwideWrapperUrl] = useState("");
  const [originalWorldwideWrapperUrl, setOriginalWorldwideWrapperUrl] = useState("");
  const [isSavingWorldwide, setIsSavingWorldwide] = useState(false);

  // Embed Access settings
  const [embedAccessEnabled, setEmbedAccessEnabled] = useState(false);
  const [originalEmbedAccessEnabled, setOriginalEmbedAccessEnabled] = useState(false);
  const [isSavingEmbedAccess, setIsSavingEmbedAccess] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch all settings in parallel
      const [
        { data: dataSourceData },
        { data: crichdData },
        { data: proxyData },
        { data: baseServerData },
        { data: wrapperData },
        { data: embedAccessData }
      ] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "data_source_url").single(),
        supabase.from("app_settings").select("value").eq("key", "crichd_data_source_url").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_proxy_url").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_base_server").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_wrapper_url").single(),
        supabase.from("app_settings").select("value").eq("key", "embed_access_enabled").single()
      ]);

      if (dataSourceData) {
        setDataSourceUrl(dataSourceData.value);
        setOriginalDataSourceUrl(dataSourceData.value);
      }
      if (crichdData) {
        setCrichdDataSourceUrl(crichdData.value);
        setOriginalCrichdDataSourceUrl(crichdData.value);
      }
      if (proxyData) {
        setWorldwideProxyUrl(proxyData.value);
        setOriginalWorldwideProxyUrl(proxyData.value);
      }
      if (baseServerData) {
        const val = baseServerData.value === 'IN' ? 'IN' : 'BD';
        setWorldwideBaseServer(val);
        setOriginalWorldwideBaseServer(val);
      }
      if (wrapperData) {
        setWorldwideWrapperUrl(wrapperData.value);
        setOriginalWorldwideWrapperUrl(wrapperData.value);
      }
      if (embedAccessData) {
        const enabled = embedAccessData.value === 'true';
        setEmbedAccessEnabled(enabled);
        setOriginalEmbedAccessEnabled(enabled);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDataSourceUrl = async () => {
    const trimmedUrl = dataSourceUrl.trim();
    if (!trimmedUrl) {
      toast({ title: "Error", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }
    try { new URL(trimmedUrl); } catch {
      toast({ title: "Error", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    setIsSavingUrl(true);
    const { error } = await supabase.from("app_settings").update({ value: trimmedUrl }).eq("key", "data_source_url");
    if (error) {
      toast({ title: "Error", description: "Failed to save URL", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "FanCode URL saved" });
      setOriginalDataSourceUrl(trimmedUrl);
    }
    setIsSavingUrl(false);
  };

  const handleSaveCrichdDataSourceUrl = async () => {
    const trimmedUrl = crichdDataSourceUrl.trim();
    if (!trimmedUrl) {
      toast({ title: "Error", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }
    try { new URL(trimmedUrl); } catch {
      toast({ title: "Error", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    setIsSavingCrichdUrl(true);
    const { error } = await supabase.from("app_settings").update({ value: trimmedUrl }).eq("key", "crichd_data_source_url");
    if (error) {
      toast({ title: "Error", description: "Failed to save URL", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "CricHd URL saved" });
      setOriginalCrichdDataSourceUrl(trimmedUrl);
    }
    setIsSavingCrichdUrl(false);
  };

  const handleSaveWorldwideSettings = async () => {
    setIsSavingWorldwide(true);
    const [proxyRes, serverRes, wrapperRes] = await Promise.all([
      supabase.from("app_settings").update({ value: worldwideProxyUrl.trim() }).eq("key", "worldwide_proxy_url"),
      supabase.from("app_settings").update({ value: worldwideBaseServer }).eq("key", "worldwide_base_server"),
      supabase.from("app_settings").update({ value: worldwideWrapperUrl.trim() }).eq("key", "worldwide_wrapper_url")
    ]);

    if (proxyRes.error || serverRes.error || wrapperRes.error) {
      toast({ title: "Error", description: "Failed to save Worldwide settings", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Worldwide settings saved" });
      setOriginalWorldwideProxyUrl(worldwideProxyUrl.trim());
      setOriginalWorldwideBaseServer(worldwideBaseServer);
      setOriginalWorldwideWrapperUrl(worldwideWrapperUrl.trim());
    }
    setIsSavingWorldwide(false);
  };

  const handleToggleEmbedAccess = async (enabled: boolean) => {
    setIsSavingEmbedAccess(true);
    setEmbedAccessEnabled(enabled);
    const { error } = await supabase.from("app_settings").update({ value: enabled ? 'true' : 'false' }).eq("key", "embed_access_enabled");
    if (error) {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
      setEmbedAccessEnabled(!enabled);
    } else {
      toast({ title: "Success", description: `Embed Access ${enabled ? 'enabled' : 'disabled'}` });
      setOriginalEmbedAccessEnabled(enabled);
    }
    setIsSavingEmbedAccess(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Source Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Source URLs
          </CardTitle>
          <CardDescription>
            Configure the GitHub JSON URLs for fetching data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* FanCode */}
          <div className="space-y-2">
            <Label htmlFor="fancode-url">FanCode JSON URL</Label>
            <div className="flex gap-2">
              <Input
                id="fancode-url"
                placeholder="https://raw.githubusercontent.com/..."
                value={dataSourceUrl}
                onChange={(e) => setDataSourceUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveDataSourceUrl}
                disabled={isSavingUrl || dataSourceUrl === originalDataSourceUrl}
                size="icon"
              >
                {isSavingUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* CricHd */}
          <div className="space-y-2">
            <Label htmlFor="crichd-url">CricHd JSON URL</Label>
            <div className="flex gap-2">
              <Input
                id="crichd-url"
                placeholder="https://raw.githubusercontent.com/..."
                value={crichdDataSourceUrl}
                onChange={(e) => setCrichdDataSourceUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleSaveCrichdDataSourceUrl}
                disabled={isSavingCrichdUrl || crichdDataSourceUrl === originalCrichdDataSourceUrl}
                size="icon"
              >
                {isSavingCrichdUrl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Settings */}
      <PlayerSettings />

      {/* Link Prefix Settings */}
      <LinkPrefixSettings />

      {/* Worldwide Server Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Worldwide Server Settings
          </CardTitle>
          <CardDescription>
            Configure the proxy URL and base server for Watch Worldwide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wrapper-url">Wrapper/Embed URL</Label>
            <Input
              id="wrapper-url"
              placeholder="https://example.com/play.php?c="
              value={worldwideWrapperUrl}
              onChange={(e) => setWorldwideWrapperUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-url">Proxy URL Prefix</Label>
            <Input
              id="proxy-url"
              placeholder="https://example.com/proxy.php?link="
              value={worldwideProxyUrl}
              onChange={(e) => setWorldwideProxyUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Base Server</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="base-server"
                  value="BD"
                  checked={worldwideBaseServer === 'BD'}
                  onChange={() => setWorldwideBaseServer('BD')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">BD Server</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="base-server"
                  value="IN"
                  checked={worldwideBaseServer === 'IN'}
                  onChange={() => setWorldwideBaseServer('IN')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">IN Server</span>
              </label>
            </div>
          </div>

          <Button
            onClick={handleSaveWorldwideSettings}
            disabled={isSavingWorldwide || (
              worldwideProxyUrl === originalWorldwideProxyUrl && 
              worldwideBaseServer === originalWorldwideBaseServer && 
              worldwideWrapperUrl === originalWorldwideWrapperUrl
            )}
          >
            {isSavingWorldwide ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Worldwide Settings
          </Button>
        </CardContent>
      </Card>

      {/* Embed Access Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Embed Access Control
          </CardTitle>
          <CardDescription>
            Restrict site access to iframe embeds only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Embed-Only Access</p>
              <p className="text-sm text-muted-foreground">
                {embedAccessEnabled 
                  ? 'Site restricted to iframe embeds from allowed domains' 
                  : 'Site accessible directly without iframe restrictions'}
              </p>
            </div>
            <Switch
              checked={embedAccessEnabled}
              onCheckedChange={handleToggleEmbedAccess}
              disabled={isSavingEmbedAccess}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ⚠️ Admin panel and logged-in admins always bypass this restriction.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
