/**
 * VoiceMessagePlayer Component
 * WhatsApp-style voice message player with waveform visualization
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const VoiceMessagePlayer = ({ 
  audioUrl, 
  duration,
  isOwn = false,
  moduleColor = '#059669' 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds === Infinity) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate static waveform bars (simulated)
  const generateWaveform = () => {
    const bars = [];
    const barCount = 35;
    for (let i = 0; i < barCount; i++) {
      // Create a pattern that looks like audio waveform
      const height = Math.sin(i * 0.5) * 0.3 + Math.random() * 0.5 + 0.2;
      bars.push(Math.min(1, Math.max(0.1, height)));
    }
    return bars;
  };

  const [waveform] = useState(generateWaveform);

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Toggle playback speed
  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackRate(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle audio loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  // Handle audio ended
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handle click on waveform to seek
  const handleWaveformClick = (e) => {
    if (!audioRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioDuration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Calculate progress percentage
  const progressPercentage = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className={`voice-message-player ${isOwn ? 'own' : 'other'}`}>
      {/* Play button */}
      <button 
        className="voice-player-btn"
        onClick={togglePlay}
        style={{ 
          backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : moduleColor,
          color: isOwn ? '#fff' : '#fff'
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      
      {/* Waveform visualization */}
      <div 
        className="voice-player-waveform"
        ref={progressRef}
        onClick={handleWaveformClick}
      >
        {waveform.map((height, i) => {
          const barProgress = (i / waveform.length) * 100;
          const isPlayed = barProgress <= progressPercentage;
          
          return (
            <div 
              key={i}
              className={`voice-waveform-bar ${isPlayed ? 'played' : ''}`}
              style={{ 
                height: `${height * 28}px`,
                backgroundColor: isPlayed 
                  ? (isOwn ? 'rgba(255,255,255,0.9)' : moduleColor)
                  : (isOwn ? 'rgba(255,255,255,0.4)' : '#c5c5c5')
              }}
            />
          );
        })}
      </div>
      
      {/* Time and speed */}
      <div className="voice-player-info">
        <span className="voice-player-time">
          {isPlaying || currentTime > 0 
            ? formatTime(currentTime) 
            : formatTime(audioDuration)
          }
        </span>
        {isPlaying && playbackRate !== 1 && (
          <button 
            className="voice-speed-btn"
            onClick={toggleSpeed}
          >
            {playbackRate}x
          </button>
        )}
      </div>
      
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  );
};

export default VoiceMessagePlayer;
