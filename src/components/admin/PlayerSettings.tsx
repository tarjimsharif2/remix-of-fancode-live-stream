import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlayerType, PLAYER_CONFIGS } from "@/types/playerTypes";

export const PlayerSettings = () => {
  const [defaultPlayer, setDefaultPlayer] = useState<PlayerType>('clappr');
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: playerData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'default_player')
          .maybeSingle();

        if (playerData?.value) {
          setDefaultPlayer(playerData.value as PlayerType);
        }

        const { data: wrapperData } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'iframe_wrapper_url')
          .maybeSingle();

        if (wrapperData?.value) {
          setIframeWrapperUrl(wrapperData.value);
        }
      } catch (err) {
        console.error('Error fetching player settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert default_player
      const { error: playerError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'default_player', value: defaultPlayer, description: 'Default video player type' },
          { onConflict: 'key' }
        );

      if (playerError) throw playerError;

      // Upsert iframe_wrapper_url
      const { error: wrapperError } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'iframe_wrapper_url', value: iframeWrapperUrl, description: 'Wrapper URL for iframe player' },
          { onConflict: 'key' }
        );

      if (wrapperError) throw wrapperError;

      toast.success('Player settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Player Settings
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
          <Settings className="w-5 h-5" />
          Player Settings
        </CardTitle>
        <CardDescription>
          Configure default video player for JSON sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Player Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Default Player</Label>
          <RadioGroup
            value={defaultPlayer}
            onValueChange={(value) => setDefaultPlayer(value as PlayerType)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {PLAYER_CONFIGS.map((config) => (
              <div key={config.type} className="flex items-start space-x-3">
                <RadioGroupItem value={config.type} id={config.type} className="mt-1" />
                <Label htmlFor={config.type} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Iframe Wrapper URL */}
        <div className="space-y-2">
          <Label htmlFor="wrapperUrl">Iframe Wrapper URL</Label>
          <Input
            id="wrapperUrl"
            placeholder="https://example.com/embed.php?url="
            value={iframeWrapperUrl}
            onChange={(e) => setIframeWrapperUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used when Iframe player is selected. The stream URL will be appended to this.
          </p>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
