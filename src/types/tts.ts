// TTS 请求参数
export interface TTSRequest {
  target_text: string;
  reference_text?: string;
  reference_audio_base64?: string;
  model_name?: string;
  stream?: boolean;
}

// WebSocket 消息类型
export interface WSMessage {
  status?: 'started' | 'completed' | 'error';
  error?: string;
  total_chunks?: number;
}

// 音频播放状态
export interface AudioPlayState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

// 模型配置
export interface ModelConfig {
  name: string;
  sampleRate: number;
  description: string;
}

// 支持的模型列表
export const SUPPORTED_MODELS: ModelConfig[] = [
  { name: 'cosyvoice2', sampleRate: 24000, description: 'CosyVoice 2.0' },
  { name: 'cosyvoice3', sampleRate: 24000, description: 'CosyVoice 3.0' },
  { name: 'f5_tts', sampleRate: 24000, description: 'F5-TTS' },
  { name: 'spark_tts', sampleRate: 16000, description: 'Spark-TTS' }
];