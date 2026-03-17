import { Button } from "@/components/ui/button";
import { Loader2, Monitor, Mic, StopCircle, Video } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export function ScreenRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Get microphone audio if possible and mix it
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (micStream.getAudioTracks().length > 0) {
            const audioContext = new AudioContext();
            const dest = audioContext.createMediaStreamDestination();
            
            if (stream.getAudioTracks().length > 0) {
                const sysSource = audioContext.createMediaStreamSource(stream);
                sysSource.connect(dest);
            }
            
            const micSource = audioContext.createMediaStreamSource(micStream);
            micSource.connect(dest);
            
            const combinedStream = new MediaStream([
                ...stream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ]);
            
            // Use combined stream
            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
        } else {
             mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        }
      } catch (e) {
        console.warn("Microphone access denied or not available, recording system audio only if present.");
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      }

      const recorder = mediaRecorderRef.current;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = `recording-${new Date().toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      toast.success("Recording started");

      // Stop recording if user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== 'inactive') {
            recorder.stop();
        }
      };

    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  if (isRecording) {
    return (
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={stopRecording}
        className="gap-2"
      >
        <StopCircle className="h-4 w-4 animate-pulse" />
        Stop Rec
      </Button>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={startRecording}
      className="gap-2"
      title="Record screen and audio"
    >
      <Video className="h-4 w-4" />
      Record
    </Button>
  );
}
