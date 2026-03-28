<template>
  <div class="tts-container">
    <el-card class="card">
      <template #header>
        <div class="card-header">
          <span>语音合成系统</span>
          <div class="header-right">
            <el-tag :type="connectionStatus" size="small">
              {{ connectionStatusText }}
            </el-tag>
            <el-button 
              type="text" 
              size="small" 
              @click="showPerformancePanel = !showPerformancePanel"
              style="margin-left: 10px"
            >
              {{ showPerformancePanel ? '隐藏性能面板' : '显示性能面板' }}
            </el-button>
          </div>
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
            @click="downloadFullAudio"
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
    
    <!-- 性能监控面板 -->
    <el-card v-if="showPerformancePanel" class="performance-card">
      <template #header>
        <div class="card-header">
          <span>性能监控面板</span>
          <el-button type="text" size="small" @click="exportPerformanceData">
            导出数据
          </el-button>
        </div>
      </template>
      
      <!-- 实时指标 -->
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="metric-card" :class="getTTFAClass(currentMetrics.ttfa)">
            <div class="metric-title">
              <el-tooltip content="从用户点击到收到第一个音频块的时间" placement="top">
                <span>首包延迟 (TTFA) ⓘ</span>
              </el-tooltip>
            </div>
            <div class="metric-value">
              {{ formatLatency(currentMetrics.ttfa) }}
            </div>
            <div class="metric-unit">毫秒 (ms)</div>
          </div>
        </el-col>
        
        <el-col :span="6">
          <div class="metric-card">
            <div class="metric-title">
              <el-tooltip content="WebSocket 连接建立所需时间" placement="top">
                <span>连接延迟 ⓘ</span>
              </el-tooltip>
            </div>
            <div class="metric-value">
              {{ formatLatency(currentMetrics.wsConnectLatency) }}
            </div>
            <div class="metric-unit">毫秒 (ms)</div>
          </div>
        </el-col>
        
        <el-col :span="6">
          <div class="metric-card">
            <div class="metric-title">
              <el-tooltip content="从开始到收到完整音频的时间" placement="top">
                <span>总延迟 ⓘ</span>
              </el-tooltip>
            </div>
            <div class="metric-value">
              {{ formatLatency(currentMetrics.totalLatency) }}
            </div>
            <div class="metric-unit">毫秒 (ms)</div>
          </div>
        </el-col>
        
        <el-col :span="6">
          <div class="metric-card">
            <div class="metric-title">
              <el-tooltip content="处理时间与音频时长的比值，小于1表示实时" placement="top">
                <span>实时率 (RTF) ⓘ</span>
              </el-tooltip>
            </div>
            <div class="metric-value" :class="getRTFClass(currentMetrics.rtf)">
              {{ formatRTF(currentMetrics.rtf) }}
            </div>
            <div class="metric-unit">实时率</div>
          </div>
        </el-col>
      </el-row>
      
      <!-- 详细统计 -->
      <el-divider />
      
      <el-row :gutter="20">
        <el-col :span="12">
          <div class="stat-section">
            <h4>音频统计</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="音频总时长">
                {{ currentMetrics.totalAudioDuration.toFixed(2) }} 秒
              </el-descriptions-item>
              <el-descriptions-item label="音频块数量">
                {{ currentMetrics.totalChunks }}
              </el-descriptions-item>
              <el-descriptions-item label="平均块大小">
                {{ (currentMetrics.averageChunkSize / 1024).toFixed(2) }} KB
              </el-descriptions-item>
              <el-descriptions-item label="文本长度">
                {{ currentMetrics.textLength }} 字符
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-col>
        
        <el-col :span="12">
          <div class="stat-section">
            <h4>网络信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="网络类型">
                {{ currentMetrics.networkType || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="有效类型">
                {{ currentMetrics.effectiveType || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="下行速度">
                {{ currentMetrics.downlink ? `${currentMetrics.downlink} Mbps` : '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="RTT">
                {{ currentMetrics.rtt ? `${currentMetrics.rtt}ms` : '未知' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-col>
      </el-row>
      
      <!-- 历史数据图表 -->
      <el-divider />
      
      <div class="chart-section">
        <h4>历史延迟趋势 (最近20次)</h4>
        <div ref="chartRef" style="height: 300px"></div>
      </div>
      
      <!-- 性能评分 -->
      <el-divider />
      
      <div class="score-section">
        <h4>性能评分</h4>
        <el-progress 
          :percentage="performanceScore" 
          :color="scoreColor"
          :format="() => `${performanceScore}分`"
        />
        <div class="score-description">
          {{ performanceDescription }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onUnmounted, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
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

// 性能指标接口
interface PerformanceMetrics {
  requestStartTime: number;
  wsConnectTime: number;
  firstAudioChunkTime: number;
  lastAudioChunkTime: number;
  wsConnectLatency: number;
  ttfa: number;
  totalLatency: number;
  totalChunks: number;
  totalAudioDuration: number;
  averageChunkSize: number;
  textLength: number;
  modelName: string;
  networkType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  rtf: number;
}

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

// 性能监控相关
const showPerformancePanel = ref(false);
const currentMetrics = ref<PerformanceMetrics>({
  requestStartTime: 0,
  wsConnectTime: 0,
  firstAudioChunkTime: 0,
  lastAudioChunkTime: 0,
  wsConnectLatency: 0,
  ttfa: 0,
  totalLatency: 0,
  totalChunks: 0,
  totalAudioDuration: 0,
  averageChunkSize: 0,
  textLength: 0,
  modelName: '',
  rtf: 0
});

const historyMetrics = ref<PerformanceMetrics[]>([]);
const chartRef = ref<HTMLElement>();
let chart: echarts.ECharts | null = null;

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

// 性能评分
const performanceScore = computed(() => {
  if (!currentMetrics.value.ttfa) return 0;
  
  let score = 100;
  
  // 首包延迟评分 (满分40分)
  if (currentMetrics.value.ttfa > 1000) score -= 40;
  else if (currentMetrics.value.ttfa > 500) score -= 25;
  else if (currentMetrics.value.ttfa > 300) score -= 15;
  else if (currentMetrics.value.ttfa > 200) score -= 5;
  
  // 实时率评分 (满分30分)
  if (currentMetrics.value.rtf > 2) score -= 30;
  else if (currentMetrics.value.rtf > 1.5) score -= 20;
  else if (currentMetrics.value.rtf > 1) score -= 10;
  else if (currentMetrics.value.rtf > 0.8) score -= 5;
  
  // 总延迟评分 (满分30分)
  if (currentMetrics.value.totalLatency > 5000) score -= 30;
  else if (currentMetrics.value.totalLatency > 3000) score -= 20;
  else if (currentMetrics.value.totalLatency > 2000) score -= 10;
  else if (currentMetrics.value.totalLatency > 1000) score -= 5;
  
  return Math.max(0, Math.min(100, score));
});

const scoreColor = computed(() => {
  if (performanceScore.value >= 80) return '#67c23a';
  if (performanceScore.value >= 60) return '#409eff';
  if (performanceScore.value >= 40) return '#e6a23c';
  return '#f56c6c';
});

const performanceDescription = computed(() => {
  if (performanceScore.value >= 90) return '优秀！系统响应非常迅速，实时性极佳。';
  if (performanceScore.value >= 75) return '良好！用户体验较好，满足实时交互需求。';
  if (performanceScore.value >= 60) return '一般！存在可感知延迟，建议优化。';
  if (performanceScore.value >= 40) return '较差！延迟明显，影响用户体验。';
  return '极差！系统响应缓慢，需要重点优化。';
});

// 格式化函数
const formatLatency = (ms: number): string => {
  if (!ms || ms === 0) return '0';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatRTF = (rtf: number): string => {
  if (!rtf || rtf === 0) return '0';
  return rtf.toFixed(3);
};

const getTTFAClass = (ttfa: number): string => {
  if (ttfa < 300) return 'excellent';
  if (ttfa < 500) return 'good';
  if (ttfa < 1000) return 'fair';
  return 'poor';
};

const getRTFClass = (rtf: number): string => {
  if (rtf < 1) return 'excellent';
  if (rtf < 1.5) return 'good';
  if (rtf < 2) return 'fair';
  return 'poor';
};

// 性能测量函数
const startPerformanceMeasurement = () => {
  const now = performance.now();
  currentMetrics.value.requestStartTime = now;
  currentMetrics.value.textLength = form.value.text.length;
  currentMetrics.value.modelName = form.value.modelName;
  
  // 获取网络信息
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    currentMetrics.value.networkType = connection.type;
    currentMetrics.value.effectiveType = connection.effectiveType;
    currentMetrics.value.downlink = connection.downlink;
    currentMetrics.value.rtt = connection.rtt;
  }
  
  console.log('[性能] 开始测量，时间戳:', now);
};

const recordWSConnect = () => {
  currentMetrics.value.wsConnectTime = performance.now();
  currentMetrics.value.wsConnectLatency = 
    currentMetrics.value.wsConnectTime - currentMetrics.value.requestStartTime;
  console.log(`[性能] WebSocket 连接建立，延迟: ${currentMetrics.value.wsConnectLatency.toFixed(2)}ms`);
};

const recordFirstChunk = (chunkSize: number) => {
  if (currentMetrics.value.firstAudioChunkTime === 0) {
    currentMetrics.value.firstAudioChunkTime = performance.now();
    currentMetrics.value.ttfa = 
      currentMetrics.value.firstAudioChunkTime - currentMetrics.value.requestStartTime;
    currentMetrics.value.totalChunks = 1;
    currentMetrics.value.averageChunkSize = chunkSize;
    
    console.log(`[性能] ★ 首包到达，TTFA: ${currentMetrics.value.ttfa.toFixed(2)}ms`);
    
    // 显示性能提示
    if (currentMetrics.value.ttfa < 300) {
      ElMessage.success(`首包延迟: ${currentMetrics.value.ttfa.toFixed(0)}ms (优秀)`);
    } else if (currentMetrics.value.ttfa < 500) {
      ElMessage.info(`首包延迟: ${currentMetrics.value.ttfa.toFixed(0)}ms (良好)`);
    } else if (currentMetrics.value.ttfa < 1000) {
      ElMessage.warning(`首包延迟: ${currentMetrics.value.ttfa.toFixed(0)}ms (可接受)`);
    } else {
      ElMessage.error(`首包延迟: ${currentMetrics.value.ttfa.toFixed(0)}ms (较差)`);
    }
  }
};

const recordChunk = (chunkSize: number) => {
  if (currentMetrics.value.totalChunks > 0) {
    const totalBytes = currentMetrics.value.averageChunkSize * currentMetrics.value.totalChunks;
    currentMetrics.value.totalChunks++;
    currentMetrics.value.averageChunkSize = (totalBytes + chunkSize) / currentMetrics.value.totalChunks;
  }
};

const recordLastChunk = () => {
  currentMetrics.value.lastAudioChunkTime = performance.now();
  currentMetrics.value.totalLatency = 
    currentMetrics.value.lastAudioChunkTime - currentMetrics.value.requestStartTime;
  
  console.log(`[性能] 音频接收完成，总延迟: ${currentMetrics.value.totalLatency.toFixed(2)}ms`);
};

const setAudioDuration = (duration: number) => {
  currentMetrics.value.totalAudioDuration = duration;
  currentMetrics.value.rtf = currentMetrics.value.totalLatency / 1000 / duration;
  
  console.log(`[性能] 音频时长: ${duration.toFixed(2)}s, RTF: ${currentMetrics.value.rtf.toFixed(3)}`);
};

const resetPerformanceMetrics = () => {
  currentMetrics.value = {
    requestStartTime: 0,
    wsConnectTime: 0,
    firstAudioChunkTime: 0,
    lastAudioChunkTime: 0,
    wsConnectLatency: 0,
    ttfa: 0,
    totalLatency: 0,
    totalChunks: 0,
    totalAudioDuration: 0,
    averageChunkSize: 0,
    textLength: 0,
    modelName: '',
    rtf: 0
  };
};

// 保存历史数据并更新图表
const saveToHistory = () => {
  if (currentMetrics.value.ttfa > 0) {
    historyMetrics.value.unshift({ ...currentMetrics.value });
    
    // 保留最近 20 条记录
    if (historyMetrics.value.length > 20) {
      historyMetrics.value.pop();
    }
    
    updateChart();
  }
};

// 更新图表
const updateChart = () => {
  if (!chart) return;
  
  const ttfaData = historyMetrics.value.map(m => m.ttfa).reverse();
  const totalLatencyData = historyMetrics.value.map(m => m.totalLatency).reverse();
  const labels = historyMetrics.value.map((_, i) => `#${historyMetrics.value.length - i}`).reverse();
  
  chart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((p: any) => {
          result += `${p.marker} ${p.seriesName}: ${p.value.toFixed(0)}ms<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['首包延迟 (TTFA)', '总延迟']
    },
    xAxis: {
      type: 'category',
      data: labels,
      name: '请求序号'
    },
    yAxis: {
      type: 'value',
      name: '延迟 (ms)',
      axisLabel: {
        formatter: (value: number) => `${value}ms`
      }
    },
    series: [
      {
        name: '首包延迟 (TTFA)',
        type: 'line',
        data: ttfaData,
        smooth: true,
        lineStyle: { color: '#409eff', width: 2 },
        areaStyle: { color: 'rgba(64, 158, 255, 0.1)' },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '总延迟',
        type: 'line',
        data: totalLatencyData,
        smooth: true,
        lineStyle: { color: '#e6a23c', width: 2 },
        areaStyle: { color: 'rgba(230, 162, 60, 0.1)' },
        symbol: 'diamond',
        symbolSize: 6
      }
    ],
    grid: {
      containLabel: true,
      left: 50,
      right: 30,
      top: 30,
      bottom: 30
    }
  });
};

// 导出性能数据
const exportPerformanceData = () => {
  const exportData = {
    summary: {
      averageTTFA: historyMetrics.value.reduce((sum, m) => sum + m.ttfa, 0) / historyMetrics.value.length,
      averageTotalLatency: historyMetrics.value.reduce((sum, m) => sum + m.totalLatency, 0) / historyMetrics.value.length,
      averageRTF: historyMetrics.value.reduce((sum, m) => sum + m.rtf, 0) / historyMetrics.value.length,
      totalTests: historyMetrics.value.length
    },
    history: historyMetrics.value,
    current: currentMetrics.value,
    exportTime: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tts_performance_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  ElMessage.success('性能数据已导出');
};

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
  
  const maxSize = 50 * 1024 * 1024;
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
    
    // 开始性能测量
    startPerformanceMeasurement();
    
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
        // 记录首包
        if (audioChunks.value.length === 0) {
          recordFirstChunk(chunk.byteLength);
        } else {
          recordChunk(chunk.byteLength);
        }
        
        audioChunks.value.push(chunk);
        enqueueAudio(chunk);
        generationStatus.value = `正在接收音频流... (已接收 ${audioChunks.value.length} 个数据块)`;
      },
      onStatus: (status: string) => {
        if (status === 'started') {
          recordWSConnect();
          generationStatus.value = '语音合成中...';
        } else if (status === 'completed') {
          recordLastChunk();
          
          // 计算音频总时长
          const totalSamples = audioChunks.value.reduce((sum, chunk) => sum + chunk.length, 0);
          const model = models.find(m => m.name === form.value.modelName);
          const sampleRate = model?.sampleRate || 24000;
          const duration = totalSamples / sampleRate;
          setAudioDuration(duration);
          
          generationStatus.value = '生成完成！';
          statusType.value = 'success';
          
          // 保存到历史
          saveToHistory();
          
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
        ElMessage.success(`语音合成成功！首包延迟: ${currentMetrics.value.ttfa.toFixed(0)}ms`);
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
    resetPerformanceMetrics();
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
  isGenerating.value = false;
  if (ttsService.getGeneratingStatus) {
    ttsService.getGeneratingStatus().value = false;
  }
  resetPerformanceMetrics();
};

const seekAudio = (value: number) => {
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

// 初始化图表
onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '延迟 (ms)' },
      series: []
    });
  }
});

// 组件卸载时清理
onUnmounted(() => {
  ttsService.stopGeneration();
  stop();
  if (chart) {
    chart.dispose();
    chart = null;
  }
});
</script>

<style scoped lang="scss">
.tts-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.card, .performance-card {
  margin-bottom: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
    
    .header-right {
      display: flex;
      align-items: center;
    }
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

// 性能面板样式
.metric-card {
  text-align: center;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s;
  
  .metric-title {
    font-size: 12px;
    color: #909399;
    margin-bottom: 8px;
  }
  
  .metric-value {
    font-size: 28px;
    font-weight: bold;
    
    &.excellent {
      color: #67c23a;
    }
    
    &.good {
      color: #409eff;
    }
    
    &.fair {
      color: #e6a23c;
    }
    
    &.poor {
      color: #f56c6c;
    }
  }
  
  .metric-unit {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
}

.stat-section, .chart-section, .score-section {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
  }
}

.score-section {
  .score-description {
    margin-top: 10px;
    font-size: 13px;
    color: #606266;
    line-height: 1.5;
  }
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
  
  .metric-card {
    margin-bottom: 10px;
  }
}
</style>