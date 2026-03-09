
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCameraSchema, type InsertCamera, type Camera } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Camera as CameraIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CamerasPage() {
  const queryClient = useQueryClient();
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const { data: cameras, isLoading } = useQuery<Camera[]>({
    queryKey: ["/api/cameras"],
  });

  const addCamera = useMutation({
    mutationFn: async (data: InsertCamera) => {
      await apiRequest("POST", "/api/cameras", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cameras"] });
      form.reset();
    },
  });

  const deleteCamera = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cameras/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cameras"] });
      if (selectedCameraId === deleteCamera.variables) setSelectedCameraId(null);
    },
  });

  const ptzControl = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      await apiRequest("POST", `/api/cameras/${id}/ptz`, { action });
    },
  });

  const form = useForm<InsertCamera>({
    resolver: zodResolver(insertCameraSchema),
    defaultValues: {
      name: "",
      ip: "",
      username: "admin",
      password: "password",
      onvifPort: 5000,
      rtspPort: 554,
    },
  });

  const selectedCamera = cameras?.find(c => c.id === selectedCameraId);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar List */}
      <div className="w-80 border-r p-4 flex flex-col gap-4 bg-muted/20">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CameraIcon className="w-6 h-6" /> Cameras
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            cameras?.map((camera) => (
              <div
                key={camera.id}
                className={`p-3 rounded border cursor-pointer flex justify-between items-center transition-colors ${
                  selectedCameraId === camera.id ? "bg-accent border-accent-foreground/20" : "hover:bg-accent/50 border-transparent"
                }`}
                onClick={() => setSelectedCameraId(camera.id)}
              >
                <div>
                  <div className="font-medium">{camera.name}</div>
                  <div className="text-xs text-muted-foreground">{camera.ip}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm("Are you sure?")) deleteCamera.mutate(camera.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
          {cameras?.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No cameras added yet.
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2 text-sm">Add New Camera</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addCamera.mutate(data))} className="space-y-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormControl><Input placeholder="Camera Name" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="ip" render={({ field }) => (
                <FormItem><FormControl><Input placeholder="IP Address (e.g. 192.168.0.4)" {...field} /></FormControl></FormItem>
              )} />
               <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem><FormControl><Input placeholder="User" {...field} value={field.value || ''} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormControl><Input type="password" placeholder="Pass" {...field} value={field.value || ''} /></FormControl></FormItem>
                )} />
               </div>
              <Button type="submit" className="w-full" disabled={addCamera.isPending}>
                {addCamera.isPending ? "Adding..." : "Add Camera"}
              </Button>
            </form>
          </Form>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-background">
        {selectedCamera ? (
          <div className="w-full max-w-4xl space-y-6">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-bold flex items-center gap-2">
                 {selectedCamera.name}
                 <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                   {selectedCamera.ip}
                 </span>
               </h2>
            </div>
            
            <Card className="border-2 border-border/50 shadow-sm">
                <CardContent className="p-0 aspect-video bg-black flex items-center justify-center relative overflow-hidden rounded-lg">
                    {/* Live Snapshot View (auto-refreshing) */}
                    <LiveView id={selectedCamera.id} />
                </CardContent>
            </Card>

            <div className="bg-muted/30 p-6 rounded-xl border flex flex-col items-center gap-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">PTZ Controls</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div />
                    <Button variant="outline" size="lg" 
                        onMouseDown={() => ptzControl.mutate({ id: selectedCamera.id, action: 'up' })} 
                        onMouseUp={() => ptzControl.mutate({ id: selectedCamera.id, action: 'stop' })}>
                        <ChevronUp className="w-6 h-6" />
                    </Button>
                    <div />
                    
                    <Button variant="outline" size="lg" 
                        onMouseDown={() => ptzControl.mutate({ id: selectedCamera.id, action: 'left' })} 
                        onMouseUp={() => ptzControl.mutate({ id: selectedCamera.id, action: 'stop' })}>
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div className="flex flex-col gap-2 justify-center">
                        <Button size="icon" variant="secondary" onClick={() => ptzControl.mutate({ id: selectedCamera.id, action: 'in' })}><ZoomIn className="w-4 h-4" /></Button>
                        <Button size="icon" variant="secondary" onClick={() => ptzControl.mutate({ id: selectedCamera.id, action: 'out' })}><ZoomOut className="w-4 h-4" /></Button>
                    </div>
                    <Button variant="outline" size="lg" 
                        onMouseDown={() => ptzControl.mutate({ id: selectedCamera.id, action: 'right' })} 
                        onMouseUp={() => ptzControl.mutate({ id: selectedCamera.id, action: 'stop' })}>
                        <ChevronRight className="w-6 h-6" />
                    </Button>

                    <div />
                    <Button variant="outline" size="lg" 
                        onMouseDown={() => ptzControl.mutate({ id: selectedCamera.id, action: 'down' })} 
                        onMouseUp={() => ptzControl.mutate({ id: selectedCamera.id, action: 'stop' })}>
                        <ChevronDown className="w-6 h-6" />
                    </Button>
                    <div />
                </div>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                <CameraIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium">Select a camera</h3>
            <p className="text-muted-foreground">Choose a camera from the sidebar or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveView({ id }: { id: string }) {
    const [timestamp, setTimestamp] = useState(Date.now());
    
    useEffect(() => {
        const interval = setInterval(() => setTimestamp(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <img 
            src={`/api/cameras/${id}/snapshot?t=${timestamp}`} 
            alt="Live View" 
            className="w-full h-full object-contain"
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null; // prevent loop
                // target.src = "/placeholder.jpg"; // if we had one
            }}
        />
    );
}
