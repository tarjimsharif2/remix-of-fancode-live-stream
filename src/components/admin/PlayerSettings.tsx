import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlayerType, PLAYER_CONFIGS } from "@/types/playerTypes";

export const PlayerSettings = () => {
  const [defaultPlayer, setDefaultPlayer] = useState<PlayerType>('clappr');
  const [myplayPlayer, setMyplayPlayer] = useState<PlayerType>('clappr');
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState('');
  const [myplayWrapperUrl, setMyplayWrapperUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [
          { data: playerData },
          { data: myplayData },
          { data: wrapperData },
          { data: myplayWrapperData }
        ] = await Promise.all([
          supabase.from('app_settings').select('value').eq('key', 'default_player').maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', 'myplay_player').maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', 'iframe_wrapper_url').maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', 'myplay_wrapper_url').maybeSingle()
        ]);

        if (playerData?.value) setDefaultPlayer(playerData.value as PlayerType);
        if (myplayData?.value) setMyplayPlayer(myplayData.value as PlayerType);
        if (wrapperData?.value) setIframeWrapperUrl(wrapperData.value);
        if (myplayWrapperData?.value) setMyplayWrapperUrl(myplayWrapperData.value);
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
      const updates = [
        { key: 'default_player', value: defaultPlayer, description: 'Default video player for JSON sources' },
        { key: 'myplay_player', value: myplayPlayer, description: 'Default video player for MyPlay' },
        { key: 'iframe_wrapper_url', value: iframeWrapperUrl, description: 'Wrapper URL for iframe player (JSON)' },
        { key: 'myplay_wrapper_url', value: myplayWrapperUrl, description: 'Wrapper URL for iframe player (MyPlay)' }
      ];

      const results = await Promise.all(
        updates.map(item =>
          supabase.from('app_settings').upsert(item, { onConflict: 'key' })
        )
      );

      const hasError = results.some(r => r.error);
      if (hasError) throw new Error('Failed to save some settings');

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

  const PlayerSelector = ({ 
    value, 
    onChange, 
    wrapperUrl, 
    onWrapperChange,
    wrapperLabel 
  }: { 
    value: PlayerType; 
    onChange: (v: PlayerType) => void;
    wrapperUrl: string;
    onWrapperChange: (v: string) => void;
    wrapperLabel: string;
  }) => (
    <div className="space-y-4">
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as PlayerType)}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {PLAYER_CONFIGS.map((config) => (
          <div key={config.type} className="flex items-start space-x-3">
            <RadioGroupItem value={config.type} id={`${config.type}-${wrapperLabel}`} className="mt-1" />
            <Label htmlFor={`${config.type}-${wrapperLabel}`} className="flex-1 cursor-pointer">
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

      {value === 'iframe' && (
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor={`wrapper-${wrapperLabel}`}>Iframe Wrapper URL</Label>
          <Input
            id={`wrapper-${wrapperLabel}`}
            placeholder="https://example.com/embed.php?url="
            value={wrapperUrl}
            onChange={(e) => onWrapperChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Stream URL will be appended to this wrapper.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Player Settings
        </CardTitle>
        <CardDescription>
          Configure default video players for different sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="json" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json">JSON Sources</TabsTrigger>
            <TabsTrigger value="myplay">MyPlay</TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="mt-4">
            <div className="space-y-2 mb-4">
              <Label className="text-base font-medium">Default Player (JSON Sources)</Label>
              <p className="text-sm text-muted-foreground">
                Player used for /live/:slug streams
              </p>
            </div>
            <PlayerSelector
              value={defaultPlayer}
              onChange={setDefaultPlayer}
              wrapperUrl={iframeWrapperUrl}
              onWrapperChange={setIframeWrapperUrl}
              wrapperLabel="json"
            />
          </TabsContent>

          <TabsContent value="myplay" className="mt-4">
            <div className="space-y-2 mb-4">
              <Label className="text-base font-medium">Default Player (MyPlay)</Label>
              <p className="text-sm text-muted-foreground">
                Player used for /myplay custom channels
              </p>
            </div>
            <PlayerSelector
              value={myplayPlayer}
              onChange={setMyplayPlayer}
              wrapperUrl={myplayWrapperUrl}
              onWrapperChange={setMyplayWrapperUrl}
              wrapperLabel="myplay"
            />
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Player Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};