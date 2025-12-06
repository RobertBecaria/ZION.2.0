/**
 * VoiceRecorder Component
 * WhatsApp-style voice message recorder with waveform visualization
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Send, X, Trash2, Pause, Play } from 'lucide-react';

const VoiceRecorder = ({ 
  onSend, 
  onCancel, 
  moduleColor = '#059669',
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [waveformData, setWaveformData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const animationRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      // Set up audio context for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start waveform visualization
      visualize();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ.');
    }
  };

  // Visualize audio waveform
  const visualize = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Get average of frequency data for simple visualization
        const bars = [];
        const barCount = 30;
        const step = Math.floor(bufferLength / barCount);
        
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j];
          }
          bars.push(sum / step / 255); // Normalize to 0-1
        }
        
        setWaveformData(bars);
      }
    };
    
    draw();
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setIsPaused(false);
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      visualize();
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    setIsPaused(!isPaused);
  };

  // Cancel recording
  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setWaveformData([]);
    setRecordingTime(0);
    onCancel && onCancel();
  };

  // Send voice message
  const sendVoiceMessage = () => {
    if (audioBlob) {
      onSend && onSend(audioBlob, recordingTime);
      cancelRecording();
    }
  };

  // Play/pause preview
  const togglePlayPreview = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // If we have a recorded audio, show preview
  if (audioUrl && !isRecording) {
    return (
      <div className="voice-recorder-preview">
        <button 
          type="button" 
          className="voice-cancel-btn"
          onClick={cancelRecording}
          title="Удалить"
        >
          <Trash2 size={20} />
        </button>
        
        <div className="voice-preview-content">
          <button 
            type="button"
            className="voice-play-btn"
            onClick={togglePlayPreview}
            style={{ backgroundColor: moduleColor }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          <div className="voice-preview-waveform">
            {waveformData.map((height, i) => (
              <div 
                key={i}
                className="waveform-bar preview"
                style={{ 
                  height: `${Math.max(4, height * 30)}px`,
                  backgroundColor: moduleColor
                }}
              />
            ))}
          </div>
          
          <span className="voice-time">{formatTime(recordingTime)}</span>
        </div>
        
        <button 
          type="button"
          className="voice-send-btn"
          onClick={sendVoiceMessage}
          style={{ backgroundColor: moduleColor }}
          title="Отправить"
        >
          <Send size={20} />
        </button>
        
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  // Recording in progress
  if (isRecording) {
    return (
      <div className="voice-recorder-active">
        <button 
          type="button" 
          className="voice-cancel-btn"
          onClick={cancelRecording}
          title="Отмена"
        >
          <X size={20} />
        </button>
        
        <div className="voice-recording-indicator">
          <div className={`recording-dot ${isPaused ? 'paused' : ''}`} />
          <span className="voice-time">{formatTime(recordingTime)}</span>
        </div>
        
        <div className="voice-waveform">
          {waveformData.map((height, i) => (
            <div 
              key={i}
              className={`waveform-bar ${isPaused ? 'paused' : ''}`}
              style={{ 
                height: `${Math.max(4, height * 40)}px`,
                backgroundColor: moduleColor
              }}
            />
          ))}
        </div>
        
        <button 
          type="button"
          className="voice-pause-btn"
          onClick={togglePause}
          title={isPaused ? "Продолжить" : "Пауза"}
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        
        <button 
          type="button"
          className="voice-stop-btn"
          onClick={stopRecording}
          style={{ backgroundColor: moduleColor }}
          title="Остановить"
        >
          <Send size={20} />
        </button>
      </div>
    );
  }

  // Default mic button
  return (
    <button
      type="button"
      className="voice-mic-btn"
      onClick={startRecording}
      disabled={disabled}
      title="Записать голосовое сообщение"
    >
      <Mic size={24} color={disabled ? "#9ca3af" : moduleColor} />
    </button>
  );
};

export default VoiceRecorder;
