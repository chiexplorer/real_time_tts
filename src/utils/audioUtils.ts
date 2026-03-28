/**
 * 将 File 对象转换为 Base64 字符串
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
		let rawFile = file;
    
    // 如果是 Proxy 对象，尝试获取原始对象
    if (file && typeof file === 'object' && 'raw' in file) {
      rawFile = (file as any).raw
    }
    
    // 再次验证是否为 Blob/File 类型
    if (!(rawFile instanceof Blob)) {
      reject(new Error(`参数类型错误：期望 Blob/File，实际得到 ${typeof rawFile}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(rawFile);
  });
};

/**
 * 将 Float32Array 转换为 WAV 文件 Blob
 */
export const float32ToWav = (
  data: Float32Array,
  sampleRate: number = 24000
): Blob => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = data.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write PCM data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, str: string) => {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
};

/**
 * 下载音频文件
 */
export const downloadAudio = (audioData: Float32Array, sampleRate: number, filename: string) => {
  const wavBlob = float32ToWav(audioData, sampleRate);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 合并多个 Float32Array
 */
export const mergeAudioChunks = (chunks: Float32Array[]): Float32Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
};