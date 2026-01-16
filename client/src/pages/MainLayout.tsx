import { Switch, Route } from "wouter";
import { TTSProvider } from "@/contexts/tts-context";
import Home from "@/pages/home";
import Debug from "@/pages/debug";
import Workspace from "@/pages/workspace";
import Terminal from "@/pages/terminal";
import DatabaseExplorer from "@/pages/database-explorer";
import RagDebug from "@/pages/rag-debug";
import Landing from "@/pages/landing";
import Install from "@/pages/install";
import Docs from "@/pages/docs";
import Collaborate from "@/pages/collaborate";
import AgentSettings from "@/pages/agent-settings";
import Vision from "@/pages/vision";
import Glasses from "@/pages/glasses";
import Watch from "@/pages/watch";
import Editor from "@/pages/editor";
import Live from "@/pages/live";
import Settings from "@/pages/settings";
import Browser from "@/pages/browser";
import WebSearch from "@/pages/web-search";
import TaskQueue from "@/pages/task-queue";
import Schedules from "@/pages/schedules";
import PythonSandbox from "@/pages/python-sandbox";
import Preview from "@/pages/preview";
import PlaywrightTesting from "@/pages/playwright-testing";
import NotFound from "@/pages/not-found";
import MusicGeneration from "@/pages/music-generation";
import MarkdownPlayground from "@/pages/markdown-playground";
import KnowledgeIngestion from "@/pages/knowledge-ingestion";
import ImageGeneration from "@/pages/image-generation";
import Help from "@/pages/help";
import GoogleServices from "@/pages/google-services";
import ExpressiveSpeech from "@/pages/expressive-speech";
import Evolution from "@/pages/evolution";

export default function MainLayout() {
  return (
    <TTSProvider>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/chat" component={Home} />
        <Route path="/chat/:id" component={Home} />
        <Route path="/debug" component={Debug} />
        <Route path="/workspace" component={Workspace} />
        <Route path="/terminal" component={Terminal} />
        <Route path="/database" component={DatabaseExplorer} />
        <Route path="/rag-debug" component={RagDebug} />
        <Route path="/landing" component={Landing} />
        <Route path="/install" component={Install} />
        <Route path="/docs" component={Docs} />
        <Route path="/docs/:path*" component={Docs} />
        <Route path="/collaborate" component={Collaborate} />
        <Route path="/agent-settings" component={AgentSettings} />
        <Route path="/vision" component={Vision} />
        <Route path="/glasses" component={Glasses} />
        <Route path="/watch" component={Watch} />
        <Route path="/editor" component={Editor} />
        <Route path="/live" component={Live} />
        <Route path="/settings" component={Settings} />
        <Route path="/browser" component={Browser} />
        <Route path="/web-search" component={WebSearch} />
        <Route path="/task-queue" component={TaskQueue} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/python" component={PythonSandbox} />
        <Route path="/preview" component={Preview} />
        <Route path="/playwright" component={PlaywrightTesting} />
        <Route path="/music" component={MusicGeneration} />
        <Route path="/markdown" component={MarkdownPlayground} />
        <Route path="/knowledge" component={KnowledgeIngestion} />
        <Route path="/image" component={ImageGeneration} />
        <Route path="/help" component={Help} />
        <Route path="/google" component={GoogleServices} />
        <Route path="/speech" component={ExpressiveSpeech} />
        <Route path="/evolution" component={Evolution} />
        <Route component={NotFound} />
      </Switch>
    </TTSProvider>
  );
}
