import { ref, computed, onUnmounted } from 'vue';

export interface AudioPlayerOptions {
  sampleRate?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export function useAudioPlayer(options: AudioPlayerOptions = {}) {
  const {
    sampleRate = 24000,
    onPlay,
    onPause,
    onEnded,
    onError
  } = options;

  const audioContext = ref<AudioContext | null>(null);
  const currentSource = ref<AudioBufferSourceNode | null>(null);
  const audioQueue = ref<AudioBuffer[]>([]);
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const currentTime = ref(0);
  const totalDuration = ref(0);
  const volume = ref(1);

  // 初始化音频上下文
  const initAudioContext = () => {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext.value;
  };

  // 将 PCM 数据转换为 AudioBuffer
  const pcmToAudioBuffer = async (pcmData: Float32Array): Promise<AudioBuffer> => {
    const ctx = initAudioContext();
    const buffer = ctx.createBuffer(1, pcmData.length, sampleRate);
    buffer.copyToChannel(pcmData, 0);
    return buffer;
  };

  // 添加音频块到队列
  const enqueueAudio = async (audioChunk: Float32Array | ArrayBuffer) => {
    let pcmData: Float32Array;
    
    if (audioChunk instanceof ArrayBuffer) {
      // 如果是原始 PCM 数据（32位浮点）
      pcmData = new Float32Array(audioChunk);
    } else if (audioChunk instanceof Float32Array) {
      pcmData = audioChunk;
    } else {
      throw new Error('Unsupported audio data type');
    }
    
    const audioBuffer = await pcmToAudioBuffer(pcmData);
    audioQueue.value.push(audioBuffer);
    totalDuration.value += audioBuffer.duration;
    
    // 如果没有正在播放，自动开始播放
    if (!isPlaying.value && !isPaused.value) {
      play();
    }
  };

  // 播放音频
  const play = async () => {
    if (audioQueue.value.length === 0) {
      return;
    }
    
    const ctx = initAudioContext();
    
    // 恢复音频上下文（浏览器策略）
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // 停止当前播放
    if (currentSource.value) {
      currentSource.value.stop();
      currentSource.value.disconnect();
    }
    
    // 获取下一个音频块
    const audioBuffer = audioQueue.value[0];
    
    // 创建音频源
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    // 设置音量
    const gainNode = ctx.createGain();
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volume.value;
    
    // 播放结束处理
    source.onended = () => {
      // 移除已播放的音频块
      audioQueue.value.shift();
      currentSource.value = null;
      
      if (audioQueue.value.length > 0) {
        // 继续播放下一个
        play();
      } else {
        isPlaying.value = false;
        isPaused.value = false;
        currentTime.value = 0;
        onEnded?.();
      }
    };
    
    source.start();
    currentSource.value = source;
    isPlaying.value = true;
    isPaused.value = false;
    onPlay?.();
    
    // 更新时间更新
    const updateTime = () => {
      if (currentSource.value && audioContext.value) {
        const elapsed = audioContext.value.currentTime - (source.startTime || 0);
        currentTime.value = Math.min(elapsed, audioBuffer.duration);
        
        if (isPlaying.value && !isPaused.value) {
          requestAnimationFrame(updateTime);
        }
      }
    };
    updateTime();
  };

  // 暂停播放
  const pause = () => {
    if (currentSource.value && audioContext.value) {
      audioContext.value.suspend();
      isPlaying.value = false;
      isPaused.value = true;
      onPause?.();
    }
  };

  // 恢复播放
  const resume = async () => {
    if (audioContext.value && isPaused.value) {
      await audioContext.value.resume();
      isPlaying.value = true;
      isPaused.value = false;
      onPlay?.();
    }
  };

  // 停止并清空队列
  const stop = () => {
    if (currentSource.value) {
      currentSource.value.stop();
      currentSource.value.disconnect();
      currentSource.value = null;
    }
    
    audioQueue.value = [];
    isPlaying.value = false;
    isPaused.value = false;
    currentTime.value = 0;
    totalDuration.value = 0;
  };

  // 设置音量
  const setVolume = (vol: number) => {
    volume.value = Math.max(0, Math.min(1, vol));
  };

  // 关闭音频上下文
  const close = () => {
    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
  };

  // 组件卸载时清理
  onUnmounted(() => {
    close();
  });

  // 计算属性
  const progress = computed(() => {
    if (totalDuration.value === 0) return 0;
    return (currentTime.value / totalDuration.value) * 100;
  });

  return {
    isPlaying,
    isPaused,
    currentTime,
    totalDuration,
    volume,
    progress,
    enqueueAudio,
    play,
    pause,
    resume,
    stop,
    setVolume,
    close
  };
}