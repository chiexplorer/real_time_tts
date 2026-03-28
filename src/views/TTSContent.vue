<template>
  <div class="tts-container">
    <el-card class="card">
      <template #header>
        <div class="card-header">
          <span>语音合成系统</span>
          <el-tag :type="connectionStatus" size="small">
            {{ connectionStatusText }}
          </el-tag>
        </div>
      </template>
      
      <el-form :model="form" label-width="100px">
        <el-form-item label="输入文本" required>
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            placeholder="请输入要合成的文本内容..."
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="提示词">
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="3"
            placeholder="请输入提示词（可选）..."
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="选择模型">
          <el-select v-model="form.modelName" placeholder="请选择模型" style="width: 100%">
            <el-option
              v-for="model in models"
              :key="model.name"
              :label="`${model.description} (${model.sampleRate / 1000}kHz)`"
              :value="model.name"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="参考音频" required>
          <el-upload
            class="upload-demo"
            drag
            :before-upload="beforeAudioUpload"
            :on-change="handleAudioChange"
            :show-file-list="false"
            accept="audio/*"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              点击或拖拽音频文件到此区域<br />
              <em>支持 WAV、MP3、FLAC 等格式</em>
            </div>
          </el-upload>
          <div v-if="form.promptFile" class="upload-file-info">
            <el-tag type="success" closable @close="clearAudioFile">
              {{ form.promptFile.name }}
            </el-tag>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            @click="generateAudio"
            :loading="isGenerating"
            :disabled="!canGenerate"
          >
            {{ isGenerating ? '生成中...' : '生成语音' }}
          </el-button>
          
          <el-button
            v-if="isPlaying"
            @click="pauseAudio"
            style="margin-left: 10px"
          >
            <el-icon><VideoPause /></el-icon>
            暂停
          </el-button>
          
          <el-button
            v-if="isPaused"
            @click="resumeAudio"
            style="margin-left: 10px"
          >
            <el-icon><VideoPlay /></el-icon>
            继续
          </el-button>
          
          <el-button
            v-if="audioChunks.length > 0"
            @click="stopAudio"
            style="margin-left: 10px"
          >
            <el-icon><Close /></el-icon>
            停止
          </el-button>
          
          <el-button
            v-if="audioChunks.length > 0"
            @click="downloadAudio"
            style="margin-left: 10px"
          >
            <el-icon><Download /></el-icon>
            下载音频
          </el-button>
        </el-form-item>
      </el-form>
      
      <!-- 音频播放进度条 -->
      <div v-if="totalDuration > 0" class="audio-progress">
        <div class="progress-label">
          <span>播放进度</span>
          <span>{{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}</span>
        </div>
        <el-slider
          v-model="progressValue"
          :format-tooltip="formatTime"
          @change="seekAudio"
        />
      </div>
      
      <!-- 音量控制 -->
      <div v-if="totalDuration > 0" class="volume-control">
        <el-icon><Mic /></el-icon>
        <el-slider
          v-model="volumeValue"
          :min="0"
          :max="100"
          style="width: 150px; margin-left: 10px"
          @change="setVolume"
        />
      </div>
      
      <!-- 生成状态提示 -->
      <div v-if="generationStatus" class="status-tip">
        <el-alert
          :title="generationStatus"
          :type="statusType"
          :closable="false"
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  UploadFilled,
  VideoPause,
  VideoPlay,
  Close,
  Download,
  Mic,
} from '@element-plus/icons-vue';
import { ttsService } from '../services/ttsService';
import { useAudioPlayer } from '../composables/useAudioPlayer';
import { fileToBase64, downloadAudio, mergeAudioChunks } from '../utils/audioUtils';
import { SUPPORTED_MODELS, type TTSRequest } from '../types/tts';

// 表单数据
const form = ref({
  text: '',
  prompt: '',
  promptFile: null as File | null,
  modelName: 'cosyvoice2'
});

// 音频数据
const audioChunks = ref<Float32Array[]>([]);
const isGenerating = ref(false);
const generationStatus = ref('');
const statusType = ref<'success' | 'warning' | 'info' | 'error'>('info');

// 模型列表
const models = SUPPORTED_MODELS;

// 音频播放器
const {
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
  setVolume: setPlayerVolume
} = useAudioPlayer({
  sampleRate: computed(() => {
    const model = models.find(m => m.name === form.value.modelName);
    return model?.sampleRate || 24000;
  }).value,
  onPlay: () => {
    console.log('Audio started playing');
  },
  onEnded: () => {
    console.log('Audio finished');
    ElMessage.success('播放完成');
  },
  onError: (error) => {
    console.error('Audio player error:', error);
    ElMessage.error('音频播放失败');
  }
});

// 计算属性
const canGenerate = computed(() => {
  return form.value.text.trim().length > 0 && form.value.promptFile !== null && !isGenerating.value;
});

const connectionStatus = computed(() => {
  return isGenerating.value ? 'warning' : 'success';
});

const connectionStatusText = computed(() => {
  return isGenerating.value ? '生成中' : '就绪';
});

const progressValue = computed({
  get: () => progress.value,
  set: (val) => seekAudio(val)
});

const volumeValue = computed({
  get: () => volume.value * 100,
  set: (val) => setVolume(val / 100)
});

// 格式化时间
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 音频上传校验
const beforeAudioUpload = (file: File) => {
  const isAudio = file.type.startsWith('audio/');
  if (!isAudio) {
    ElMessage.error('只能上传音频文件！');
    return false;
  }
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    ElMessage.error('音频文件不能超过 50MB！');
    return false;
  }
  
  return true;
};

const handleAudioChange = (file: File) => {
  form.value.promptFile = file;
};

const clearAudioFile = () => {
  form.value.promptFile = null;
};

// 生成语音
const generateAudio = async () => {
  if (!canGenerate.value) return;
  
  try {
    isGenerating.value = true;
    generationStatus.value = '正在准备音频文件...';
    statusType.value = 'info';
    
    // 清空之前的音频
    audioChunks.value = [];
    stop();
    
    // 转换音频文件为 Base64
    const audioBase64 = await fileToBase64(form.value.promptFile!);
    
    generationStatus.value = '正在连接服务器...';
    
    // 设置回调
    ttsService.setCallbacks({
      onAudioChunk: (chunk: Float32Array) => {
        audioChunks.value.push(chunk);
        enqueueAudio(chunk);
        generationStatus.value = `正在接收音频流... (已接收 ${audioChunks.value.length} 个数据块)`;
      },
      onStatus: (status: string) => {
        if (status === 'started') {
          generationStatus.value = '语音合成中...';
        } else if (status === 'completed') {
          generationStatus.value = '生成完成！';
          statusType.value = 'success';
          setTimeout(() => {
            generationStatus.value = '';
          }, 3000);
        }
      },
      onError: (error: string) => {
        throw new Error(error);
      },
      onComplete: (totalChunks: number) => {
        console.log(`生成完成，共 ${totalChunks} 个音频块`);
        ElMessage.success(`语音合成成功！共 ${totalChunks} 个音频块`);
      }
    });
    
    // 构建请求
    const request: TTSRequest = {
      target_text: form.value.text,
      reference_text: form.value.prompt || '',
      reference_audio_base64: audioBase64,
      model_name: form.value.modelName,
      stream: true
    };
    
    // 开始生成
    await ttsService.generateSpeech(request);
    
  } catch (error: any) {
    console.error('Generate audio error:', error);
    generationStatus.value = `生成失败: ${error.message}`;
    statusType.value = 'error';
    ElMessage.error(`语音合成失败: ${error.message}`);
  } finally {
    isGenerating.value = false;
  }
};

// 音频控制
const pauseAudio = () => {
  pause();
};

const resumeAudio = () => {
  resume();
};

const stopAudio = () => {
  stop();
  audioChunks.value = [];
  isGenerating.value = false; // cancel loading
  ttsService.isGenerating.value = false;  // allow next generation
};

const seekAudio = (value: number) => {
  // 跳转功能需要重新创建播放器，这里简化处理
  console.log('Seek to:', value);
};

const setVolume = (value: number) => {
  setPlayerVolume(value);
};

const downloadFullAudio = () => {
  if (audioChunks.value.length === 0) {
    ElMessage.warning('没有可下载的音频');
    return;
  }
  
  const mergedAudio = mergeAudioChunks(audioChunks.value);
  const model = models.find(m => m.name === form.value.modelName);
  const sampleRate = model?.sampleRate || 24000;
  const filename = `tts_${Date.now()}.wav`;
  
  downloadAudio(mergedAudio, sampleRate, filename);
  ElMessage.success('音频下载成功');
};

// 组件卸载时清理
onUnmounted(() => {
  ttsService.stopGeneration();
  stop();
});
</script>

<style scoped lang="scss">
.tts-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
  }
}

.upload-demo {
  width: 100%;
  
  :deep(.el-upload) {
    width: 100%;
  }
  
  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 40px 20px;
  }
}

.upload-file-info {
  margin-top: 10px;
}

.audio-progress {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
  
  .progress-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    color: #606266;
  }
}

.volume-control {
  margin-top: 15px;
  display: flex;
  align-items: center;
}

.status-tip {
  margin-top: 15px;
}

:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-textarea__inner) {
  font-family: inherit;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .tts-container {
    padding: 10px;
  }
}
</style>