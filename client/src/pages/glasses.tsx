import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Glasses, Camera, Eye, Cpu, Wifi, Zap, Brain, Scan } from "lucide-react";
import { Link } from "wouter";

import arGlassesImage from "@assets/generated_images/ar_smart_glasses_with_holographic_display.png";
import arRouterImage from "@assets/generated_images/realistic_ar_router_identification_pov.png";
import arCableImage from "@assets/generated_images/realistic_rack_back_with_ar_overlay.png";
import arChaosImage from "@assets/generated_images/realistic_cable_nightmare_with_ar_trace.png";

export default function GlassesPage() {
  const features = [
    {
      icon: Camera,
      title: "Visual Context Awareness",
      description: "See what you see. The AI understands your environment in real-time through the integrated camera."
    },
    {
      icon: Scan,
      title: "Object Recognition",
      description: "Point at any equipment, cable, or component. Instant identification with specs and documentation."
    },
    {
      icon: Eye,
      title: "Holographic Overlays",
      description: "Information floats in your field of view. No screens to look away at, no hands needed."
    },
    {
      icon: Brain,
      title: "Contextual AI Guidance",
      description: "The AI anticipates what you need based on what you're looking at and your current task."
    },
    {
      icon: Wifi,
      title: "Always Connected",
      description: "Syncs with your phone, watch, and laptop. Your unified intelligence across all devices."
    },
    {
      icon: Zap,
      title: "Instant Actions",
      description: "Voice commands execute immediately. Ask questions, take photos, log issues — hands-free."
    }
  ];

  const specs = [
    { label: "Display Type", value: "Waveguide AR" },
    { label: "Field of View", value: "52° diagonal" },
    { label: "Camera", value: "12MP + depth sensor" },
    { label: "Processor", value: "Snapdragon XR2" },
    { label: "Battery", value: "4-6 hours active" },
    { label: "Connectivity", value: "5G, WiFi 6E, BT 5.3" },
    { label: "Audio", value: "Spatial speakers + mics" },
    { label: "Weight", value: "< 50g" }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="glasses-page">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/watch">
            <Button variant="ghost" size="icon" data-testid="button-back-to-watch">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Glasses className="h-5 w-5 text-cyan-400" />
              Meowstik Vision
            </h1>
            <p className="text-sm text-muted-foreground">
              AR Glasses • Future Vision
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            {/* Hero Image */}
            <div className="rounded-2xl overflow-hidden border border-cyan-500/30">
              <img 
                src={arGlassesImage} 
                alt="AR smart glasses with holographic display" 
                className="w-full h-64 md:h-80 object-cover"
                data-testid="img-glasses-hero"
              />
              <div className="p-6 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10">
                <h2 className="text-2xl font-bold mb-3">Unified Perception</h2>
                <p className="text-lg text-muted-foreground">
                  Beyond the wrist lies a more seamless integration. Eye-worn displays with embedded cameras 
                  bring Meowstik directly into your field of view — seeing what you see, offering 
                  contextual guidance overlaid on reality itself.
                </p>
              </div>
            </div>

            {/* Capabilities Section */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Capabilities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div 
                      key={index} 
                      className="border border-border rounded-lg bg-muted/20 p-6 hover:bg-muted/30 transition-colors"
                      data-testid={`glasses-feature-${index}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-cyan-500/10 shrink-0">
                          <Icon className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">{feature.title}</h4>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chaos Image */}
            <div className="rounded-2xl overflow-hidden border border-pink-500/30">
              <img 
                src={arChaosImage} 
                alt="AR glasses cutting through cable chaos" 
                className="w-full h-64 md:h-80 object-cover"
                data-testid="img-glasses-chaos"
              />
              <div className="p-6 bg-gradient-to-br from-pink-500/10 to-orange-500/10">
                <h3 className="text-xl font-semibold mb-2">AI to the Rescue</h3>
                <p className="text-muted-foreground">
                  When you can barely see through the chaos, the AI sees for you. Point at any cable in a 
                  nightmare rat's nest and ask "where does this go?" — watch as a glowing trace line 
                  cuts through the mess, guiding you to the destination port. No more pulling random cables 
                  and hoping for the best.
                </p>
              </div>
            </div>

            {/* Real-World Use Cases */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Real-World Use Cases</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl overflow-hidden border border-cyan-500/20">
                  <img 
                    src={arRouterImage} 
                    alt="AR glasses identifying router model" 
                    className="w-full h-48 object-cover"
                    data-testid="img-ar-router"
                  />
                  <div className="p-4 bg-background/30">
                    <p className="font-medium text-cyan-400 mb-2">"What model is this router?"</p>
                    <p className="text-sm text-muted-foreground">
                      A field tech in a hard hat looks at unfamiliar equipment. The AI instantly 
                      identifies the make, model, firmware version, and pulls up the relevant 
                      documentation overlay.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-purple-500/20">
                  <img 
                    src={arCableImage} 
                    alt="AR tracing cable through cable mess" 
                    className="w-full h-48 object-cover"
                    data-testid="img-ar-cable"
                  />
                  <div className="p-4 bg-background/30">
                    <p className="font-medium text-purple-400 mb-2">"Trace this Cat-6 for me"</p>
                    <p className="text-sm text-muted-foreground">
                      Hold up the cable end. The AR overlay highlights the entire path through 
                      the infrastructure, showing exactly which port it terminates at and what 
                      device it connects to.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Specs and Vision */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-border rounded-lg bg-muted/20 p-6">
                <h3 className="text-xl font-semibold mb-4">Target Specifications</h3>
                <div className="space-y-3">
                  {specs.map((spec, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{spec.label}</span>
                      <span className="font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-6">
                <h3 className="text-xl font-semibold mb-4">The Vision</h3>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Your devices become extensions of a unified intelligence — phone, watch, laptop, glasses — 
                    all working together, adapting together, evolving together.
                  </p>
                  <p>
                    The AI doesn't just respond to commands. It anticipates. It observes. It learns your 
                    workflows and surfaces information before you ask.
                  </p>
                  <p className="italic text-sm text-muted-foreground/70">
                    One mind, many nodes. Resistance to productivity loss is futile.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="border border-cyan-500/30 rounded-lg bg-gradient-to-br from-cyan-500/5 to-purple-500/5 p-6 text-center">
              <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
              <p className="text-muted-foreground mb-4">
                Meowstik Vision is in early concept phase. We're tracking AR hardware developments 
                and preparing the software foundation.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/watch">
                  <Button variant="outline" data-testid="button-back-to-wearables">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Wearables
                  </Button>
                </Link>
                <Link href="/">
                  <Button data-testid="button-back-to-chat">
                    Back to Chat
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
