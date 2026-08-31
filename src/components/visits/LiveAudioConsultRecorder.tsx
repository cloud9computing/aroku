import React, { useState, useEffect, useRef } from 'react';
import { extractConsultationFactsFromTranscript } from '../../services/gemini';
import { uploadConsultationAudio } from '../../firebase/storageService';
import {
  IconAlertTriangle,
  IconCheck,
  IconMicrophone,
  IconPlayerStop,
  IconSparkles,
} from '@tabler/icons-react';

interface ConsultRecap {
  what_happened: string;
  decisions: string[];
  answers_captured: string[];
  audio_url?: string;
  full_transcript?: string;
}

interface LiveAudioConsultRecorderProps {
  familyId: string;
  visitId: string;
  doctorName: string;
  specialty: string;
  consentState: 'ok' | 'declined' | 'not_asked';
  onSaveRecap: (recap: ConsultRecap) => void;
}

export const LiveAudioConsultRecorder: React.FC<LiveAudioConsultRecorderProps> = ({
  familyId,
  visitId,
  doctorName,
  specialty,
  consentState,
  onSaveRecap,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [transcriptionSupported, setTranscriptionSupported] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extractedRecap, setExtractedRecap] = useState<ConsultRecap | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
        ctx.fillStyle = '#6B7E5C';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    render();
  };

  const startRecording = async () => {
    if (consentState === 'declined') {
      alert(`${doctorName} has declined recording. Please take typed notes instead.`);
      return;
    }

    setError(null);
    setExtractedRecap(null);
    setTranscript('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start(1000);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      drawWaveform();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setTranscriptionSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
          let liveText = '';
          for (let i = 0; i < event.results.length; i++) {
            liveText += event.results[i][0].transcript + ' ';
          }
          setTranscript(liveText);
        };

        recognition.onerror = (e: any) => console.warn('Speech recognition error:', e);
        recognition.start();
        recognitionRef.current = recognition;
      } else {
        setTranscriptionSupported(false);
      }

      setIsRecording(true);
      setSeconds(0);
    } catch (err) {
      console.warn('Microphone access error:', err);
      setError('Could not access the microphone. Check app permissions and try again.');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        /* already stopped */
      }
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const finalTranscript = transcript.trim();
    setIsSaving(true);
    setSavingStep('Saving the recording...');

    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      };
    });
    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());

    try {
      const audioBlob = await stopped;
      const audioUrl = await uploadConsultationAudio(familyId, visitId, audioBlob);

      let recap: ConsultRecap = { what_happened: '', decisions: [], answers_captured: [], audio_url: audioUrl, full_transcript: finalTranscript || undefined };

      if (finalTranscript) {
        setSavingStep('Gemini is extracting clinical facts & decisions...');
        try {
          const extracted = await extractConsultationFactsFromTranscript(familyId, finalTranscript, doctorName, specialty);
          recap = { ...recap, ...extracted };
        } catch (e) {
          console.warn('Consultation summarization failed; the recording and transcript are still saved:', e);
          recap.what_happened = 'Recording saved. Automatic summarization is unavailable right now — play back the recording or read the transcript below.';
        }
      } else {
        recap.what_happened = transcriptionSupported
          ? 'Recording saved. No speech was detected to transcribe automatically.'
          : 'Recording saved. Live transcription isn’t supported in this browser — play back the recording to review it.';
      }

      setExtractedRecap(recap);
      onSaveRecap(recap);
    } catch (e) {
      console.error(e);
      const detail = e instanceof Error ? e.message : String(e);
      setError(`The recording could not be saved: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-sage-light rounded-2xl p-3 shadow-2xs border border-sage/20 transition-all space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSaving}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 shadow-xs ${
              isRecording
                ? 'bg-terracotta text-white animate-pulse'
                : 'bg-paper-50 text-sage hover:bg-white'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record consultation'}
          >
            {isRecording ? <IconPlayerStop size={15} /> : <IconMicrophone size={15} />}
          </button>

          <div>
            <p className="text-[12px] font-medium text-sage-dark">
              {isRecording ? `Recording... (${formatTime(seconds)})` : 'Record this consultation'}
            </p>
            <p className="text-[10px] text-sage-muted">
              {consentState === 'ok'
                ? `${doctorName} OK'd recording`
                : consentState === 'declined'
                ? `${doctorName} declined recording`
                : 'Consent not yet requested'}
            </p>
          </div>
        </div>

        {isRecording && (
          <canvas ref={canvasRef} width={80} height={24} className="rounded" />
        )}
      </div>

      {isRecording && !transcriptionSupported && (
        <p className="text-[10px] text-ink-500 italic">
          Live transcription isn&apos;t supported in this browser, but the audio is still being recorded.
        </p>
      )}

      {isRecording && transcript && (
        <div className="bg-white/80 p-2 rounded-xl border border-sage/30 text-[11px] text-ink-800 leading-relaxed font-serif italic max-h-24 overflow-y-auto">
          &ldquo;{transcript}&rdquo;
        </div>
      )}

      {isSaving && (
        <div className="flex items-center gap-2 text-xs text-sage-dark py-2 font-medium">
          <IconSparkles size={14} className="animate-spin text-lavender" />
          <span>{savingStep}</span>
        </div>
      )}

      {error && (
        <div className="p-2 bg-terracotta-light/60 border border-terracotta/30 rounded-xl flex items-start gap-2">
          <IconAlertTriangle size={13} className="text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-[10.5px] text-ink-700">{error}</p>
        </div>
      )}

      {extractedRecap && (
        <div className="bg-white/90 p-3 rounded-xl border border-sage/30 text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between pb-1 border-b border-paper-400">
            <span className="text-[9.5px] uppercase tracking-wider text-sage-dark font-semibold">
              Consultation Recording
            </span>
            <span className="text-[9.5px] text-sage font-medium flex items-center gap-0.5">
              <IconCheck size={12} /> Saved to Visit
            </span>
          </div>

          {extractedRecap.audio_url && (
            <audio controls src={extractedRecap.audio_url} className="w-full h-8" />
          )}

          <p className="text-[11px] text-ink-800 font-serif leading-relaxed">
            {extractedRecap.what_happened}
          </p>

          {extractedRecap.decisions && extractedRecap.decisions.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[9px] uppercase tracking-wider text-terracotta font-semibold">
                Decisions & Changes:
              </p>
              {extractedRecap.decisions.map((dec, i) => (
                <p key={i} className="text-[10.5px] text-ink-700">
                  • {dec}
                </p>
              ))}
            </div>
          )}

          {extractedRecap.full_transcript && (
            <details className="pt-1">
              <summary className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold cursor-pointer">
                Full transcript
              </summary>
              <p className="text-[10.5px] text-ink-600 leading-relaxed mt-1.5 whitespace-pre-wrap">
                {extractedRecap.full_transcript}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
