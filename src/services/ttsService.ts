import { ref } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import type { TTSRequest, WSMessage } from '@/types/tts';

export class TTSService {
  private wsUrl: string;
  private onAudioChunk?: (chunk: Float32Array) => void;
  private onStatus?: (status: string) => void;
  private onError?: (error: string) => void;
  private onComplete?: (totalChunks: number) => void;
  
  private ws: ReturnType<typeof useWebSocket> | null = null;
  private isGenerating = ref(false);
  
  constructor(
    wsUrl: string = import.meta.env.VITE_WS_URL || 'ws://localhost:8010/tts/stream'
  ) {
    this.wsUrl = wsUrl;
  }
  
  // 设置回调函数
  setCallbacks(callbacks: {
    onAudioChunk?: (chunk: Float32Array) => void;
    onStatus?: (status: string) => void;
    onError?: (error: string) => void;
    onComplete?: (totalChunks: number) => void;
  }) {
    this.onAudioChunk = callbacks.onAudioChunk;
    this.onStatus = callbacks.onStatus;
    this.onError = callbacks.onError;
    this.onComplete = callbacks.onComplete;
  }
  
  // 生成语音
  async generateSpeech(request: TTSRequest): Promise<void> {
    if (this.isGenerating.value) {
      throw new Error('Already generating speech');
    }
    
    this.isGenerating.value = true;
    
    return new Promise((resolve, reject) => {
      // 创建 WebSocket 连接
      this.ws = useWebSocket({
        url: this.wsUrl,
        onMessage: (data: Blob | string) => {
          if (typeof data === 'string') {
            // 处理 JSON 消息
            const message: WSMessage = JSON.parse(data);
            
            if (message.status === 'started') {
              this.onStatus?.('started');
            } else if (message.status === 'completed') {
              this.onStatus?.('completed');
              this.onComplete?.(message.total_chunks || 0);
              this.isGenerating.value = false;
              resolve();
            } else if (message.error) {
              this.onError?.(message.error);
              this.isGenerating.value = false;
              reject(new Error(message.error));
            }
          } else {
            // 处理音频数据
            data.arrayBuffer().then(buffer => {
              const audioData = new Float32Array(buffer);
              this.onAudioChunk?.(audioData);
            }).catch(error => {
              console.error('Failed to process audio data:', error);
            });
          }
        },
        onOpen: () => {
          // 发送请求
          this.ws?.send(request);
        },
        onError: (error) => {
          this.onError?.(`WebSocket error: ${error}`);
          this.isGenerating.value = false;
          reject(error);
        },
        onClose: () => {
          if (this.isGenerating.value) {
            this.onError?.('Connection closed unexpectedly');
            this.isGenerating.value = false;
            reject(new Error('Connection closed'));
          }
        }
      });
      
      // 建立连接
      this.ws.connect();
    });
  }
  
  // 停止生成
  stopGeneration() {
    if (this.ws) {
      this.ws.disconnect();
    }
    this.isGenerating.value = false;
  }
  
  // 获取生成状态
  getGeneratingStatus() {
    return this.isGenerating;
  }
}

// 导出单例
export const ttsService = new TTSService();