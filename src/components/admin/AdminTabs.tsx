import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ListMusic, 
  Tv, 
  Globe, 
  FileJson, 
  Settings,
  Database
} from "lucide-react";
import { M3uPlaylistManager } from "./M3uPlaylistManager";
import { CustomChannelManager } from "./CustomChannelManager";
import { DomainManagement } from "./DomainManagement";
import { JsonSourceManager } from "./JsonSourceManager";
import { SettingsTab } from "./SettingsTab";

export const AdminTabs = () => {
  const [activeTab, setActiveTab] = useState("playlists");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-lg mb-6">
        <TabsTrigger 
          value="playlists" 
          className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 py-2.5"
        >
          <ListMusic className="w-4 h-4" />
          <span className="hidden sm:inline">Playlists</span>
        </TabsTrigger>
        <TabsTrigger 
          value="channels" 
          className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 py-2.5"
        >
          <Tv className="w-4 h-4" />
          <span className="hidden sm:inline">Channels</span>
        </TabsTrigger>
        <TabsTrigger 
          value="domains" 
          className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 py-2.5"
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">Domains</span>
        </TabsTrigger>
        <TabsTrigger 
          value="sources" 
          className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 py-2.5"
        >
          <FileJson className="w-4 h-4" />
          <span className="hidden sm:inline">Sources</span>
        </TabsTrigger>
        <TabsTrigger 
          value="settings" 
          className="flex-1 min-w-[100px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 py-2.5"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="playlists" className="mt-0">
        <M3uPlaylistManager />
      </TabsContent>

      <TabsContent value="channels" className="mt-0">
        <CustomChannelManager />
      </TabsContent>

      <TabsContent value="domains" className="mt-0">
        <DomainManagement />
      </TabsContent>

      <TabsContent value="sources" className="mt-0">
        <JsonSourceManager />
      </TabsContent>

      <TabsContent value="settings" className="mt-0">
        <SettingsTab />
      </TabsContent>
    </Tabs>
  );
};
