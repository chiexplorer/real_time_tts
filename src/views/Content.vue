<template>
  <div class="tts-container">
    <el-row :gutter="20">
      <!-- 文本输入框 -->
      <el-col :span="12">
        <el-form :model="form">
          <el-form-item label="输入文本" prop="text" :rules="[{ required: true, message: '请输入文本', trigger: 'blur' }]">
            <el-input v-model="form.text" placeholder="请输入文本进行语音合成" type="textarea" rows="4"></el-input>
          </el-form-item>
        </el-form>
      </el-col>

      <!-- 提示词文本输入框 -->
      <el-col :span="12">
        <el-form :model="form">
          <el-form-item label="提示词" prop="prompt" :rules="[{ required: false }]">
            <el-input v-model="form.prompt" placeholder="请输入提示词" type="textarea" rows="4"></el-input>
          </el-form-item>
        </el-form>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <!-- 说话人音色音频文件上传 -->
      <el-col :span="12">
        <el-form :model="form">
          <el-form-item label="上传音频文件" prop="promptFile">
            <el-upload
              class="upload-demo"
              drag
              action="#"
              :before-upload="beforeAudioUpload"
              :on-change="handleAudioChange"
              :show-file-list="false">
              <i class="el-icon-upload"></i>
              <div class="el-upload__text">
                <span>点击或拖拽音频文件上传</span>
              </div>
            </el-upload>
            <div v-if="form.promptFile" class="upload-file-info">
              <el-tag>{{ form.promptFile.name }}</el-tag>
            </div>
          </el-form-item>
        </el-form>
      </el-col>

      <!-- 确定生成按钮 -->
      <el-col :span="12" class="generate-btn-container">
        <el-button type="primary" @click="generateAudio" :loading="loading">生成语音</el-button>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { ElForm, ElFormItem, ElInput, ElButton, ElUpload, ElTag, ElRow, ElCol, ElMessage } from 'element-plus';

export default defineComponent({
	name: 'Content',
  components: { ElForm, ElFormItem, ElInput, ElButton, ElUpload, ElTag, ElRow, ElCol },
  setup() {
    const form = ref({
      text: '',
      prompt: '',
      promptFile: null as File | null,
    });

    const loading = ref(false);

    // 上传音频文件的校验和处理
    const beforeAudioUpload = (file: File) => {
      const isAudio = file.type.startsWith('audio/');
      if (!isAudio) {
        ElMessage.error('只能上传音频文件!');
      }
      return isAudio;
    };

    const handleAudioChange = (file: File) => {
      form.value.promptFile = file;
    };

    // 生成语音
    const generateAudio = async () => {
      if (!form.value.text) {
        return ElMessage.error('请输入文本!');
      }
      if (!form.value.promptFile) {
        return ElMessage.error('请上传音频文件!');
      }

      loading.value = true;
      try {
        // 这里调用你的grpc接口进行流式推理
        // 示例:
        // await grpcService.generateAudio(form.value.text, form.value.prompt, form.value.promptFile);
        console.log('文本:', form.value.text);
        console.log('提示词:', form.value.prompt);
        console.log('上传音频文件:', form.value.promptFile);

        // 假设成功生成了音频
        loading.value = false;
        ElMessage.success('语音生成成功');
      } catch (error) {
        loading.value = false;
        ElMessage.error('语音生成失败');
      }
    };

    return {
      form,
      loading,
      beforeAudioUpload,
      handleAudioChange,
      generateAudio,
    };
  },
});
</script>

<style scoped>
.tts-container {
  padding: 20px;
}

.upload-file-info {
  margin-top: 10px;
}

.generate-btn-container {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>