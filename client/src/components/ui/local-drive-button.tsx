import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocalDrive } from '@/contexts/LocalDriveContext';
import { Folder, FolderOpen, X, RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function LocalDriveButton() {
  const {
    isSupported,
    isConnected,
    folderName,
    needsPermission,
    connect,
    disconnect,
    requestAccess,
  } = useLocalDrive();
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled className="opacity-50">
              <Folder className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Local drive access requires Chrome or Edge</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  async function handleConnect() {
    setIsLoading(true);
    try {
      await connect();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRequestAccess() {
    setIsLoading(true);
    try {
      await requestAccess();
    } finally {
      setIsLoading(false);
    }
  }

  if (needsPermission) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestAccess}
              disabled={isLoading}
              className="gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Re-grant Access</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to re-grant access to "{folderName}"</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-green-600"
                onClick={handleConnect}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[120px] truncate">{folderName}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                onClick={disconnect}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Connected to local folder: {folderName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={isLoading}
            className="gap-2"
          >
            <Folder className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">Connect Drive</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Grant Meowstik access to a local folder</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
