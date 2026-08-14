import { useRef, useState } from "react";
import { Mic, Paperclip, Send, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function Composer({
  value,
  onChange,
  onSend,
  onUpload,
  disabled,
  hasDataset,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onUpload: (file: File) => void;
  disabled: boolean;
  hasDataset: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let base = value;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i]?.[0]?.transcript ?? "";
      onChange(`${base}${base && !base.endsWith(" ") ? " " : ""}${transcript}`.trimStart());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Couldn't hear that. Try again.");
    };
    base = value;
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div className="border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl">
        <div className="panel flex items-end gap-2 p-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.json,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Upload dataset"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
          </Button>
          <textarea
            ref={textareaRef}
            value={value}
            autoFocus
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={
              hasDataset ? "Ask anything about your data…" : "Upload a dataset, or just ask me something…"
            }
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "destructive" : "ghost"}
            aria-label={listening ? "Stop recording" : "Start voice input"}
            onClick={toggleVoice}
          >
            {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            aria-label="Send message"
            disabled={disabled || !value.trim()}
            onClick={onSend}
            className={cn(disabled && "opacity-60")}
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Numbers are computed with Python in your browser. Rows never leave your device.
        </p>
      </div>
    </div>
  );
}
