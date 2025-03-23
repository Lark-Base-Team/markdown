<!--
 * @Version    : v1.00
 * @Author     : itchaox
 * @Date       : 2023-09-26 15:10
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-03-20 20:04
 * @desc       : 主要页面
-->
<script setup>
  import { bitable } from '@lark-base-open/js-sdk';
  import { marked } from 'marked'; // 引入 marked 库
  import { ElMessage } from 'element-plus'; // 导入 ElMessage 组件

  // 配置 marked
  marked.setOptions({
    gfm: true, // 支持 GitHub Flavored Markdown
    breaks: true, // 将换行符转换为 <br>
  });

  // 国际化
  import { useI18n } from 'vue-i18n';
  const { t } = useI18n();

  // 选择模式 cell 单元格; field 字段; database 数据表
  const selectModel = ref('cell');

  const databaseList = ref();
  const databaseId = ref();
  const viewList = ref();
  const viewId = ref();
  const fieldList = ref();
  const fieldId = ref();

  const base = bitable.base;

  // 当前点击字段id
  const currentFieldId = ref();
  const recordId = ref();

  const currentValue = ref();
  const showData = ref(''); // 用于存储展示区域的数据
  const showHtml = computed(() => marked(showData.value)); // 将 Markdown 转换为 HTML

  // 添加调试状态变量
  const showDebugInfo = ref(false);
  const rawData = ref(null);
  const copySuccess = ref(false); // 添加复制成功状态
  const isEditMode = ref(false); // 添加编辑模式状态
  const editContent = ref(''); // 编辑内容

  // 切换编辑模式
  function toggleEditMode() {
    if (!isEditMode.value) {
      // 进入编辑模式，复制当前内容到编辑区
      editContent.value = showData.value;
    } else {
      // 退出编辑模式，更新显示内容并处理空行
      let content = editContent.value;
      // 去除多余的空行
      content = content.replace(/\n\s*\n/g, '\n');
      showData.value = content;
    }
    isEditMode.value = !isEditMode.value;
  }

  // 保存内容到单元格
  async function saveToCell() {
    try {
      if (!currentFieldId.value || !recordId.value) {
        throw new Error('未选择单元格');
      }
      
      // 处理文本中的多余空行
      let content = editContent.value;
      content = content.replace(/\n\s*\n/g, '\n');
      
      const table = await base.getActiveTable();
      
      // 将内容保存回单元格
      await table.setCellValue(currentFieldId.value, recordId.value, [{
        type: 'text',
        text: content
      }]);
      
      // 更新显示内容
      showData.value = content;
      editContent.value = content;
      isEditMode.value = false;
      
      // 显示保存成功提示
      ElMessage({
        message: '保存成功',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      console.error('保存单元格内容时出错:', error);
      ElMessage({
        message: '保存失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  }

  // 复制Markdown内容到剪贴板
  async function copyMarkdown() {
    try {
      // 直接使用document API，避免navigator.clipboard可能的权限问题
      const textArea = document.createElement('textarea');
      textArea.value = showData.value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 2000);
      
      // 显示复制成功提示
      ElMessage({
        message: '复制成功',
        type: 'success',
        duration: 2000
      });
    } catch (err) {
      console.error('复制失败:', err);
      ElMessage({
        message: '复制失败: ' + err.message,
        type: 'error',
        duration: 3000
      });
    }
  }

  onMounted(async () => {
    databaseList.value = await base.getTableMetaList();
  });

  // 切换数据表, 默认选择第一个视图
  async function databaseChange() {
    if (selectModel.value === 'field') {
      const table = await base.getTable(databaseId.value);
      viewList.value = await table.getViewMetaList();
      viewId.value = viewList.value[0]?.id;
    }
  }

  // 根据视图列表获取字段列表
  watch(viewId, async (newValue, oldValue) => {
    const table = await base.getTable(databaseId.value);
    const view = await table.getViewById(newValue);
    const _list = await view.getFieldMetaList();

    // 只展示文本相关字段
    fieldList.value = _list.filter((item) => item.type === 1);
  });

  // 切换选择模式时,重置选择
  watch(selectModel, async (newValue, oldValue) => {
    if (newValue === 'cell') return;
    // 单列和数据表模式，默认选中当前数据表和当前视图

    const selection = await base.getSelection();
    databaseId.value = selection.tableId;

    if (newValue === 'field') {
      fieldId.value = '';
      fieldList.value = [];
      viewId.value = '';

      const table = await base.getTable(databaseId.value);
      viewList.value = await table.getViewMetaList();
      viewId.value = selection.viewId;
    }
  });

  // 数据表修改后，自动获取视图列表
  watchEffect(async () => {
    const table = await base.getTable(databaseId.value);
    viewList.value = await table.getViewMetaList();
  });

  // 实现上一个和下一个单元格的功能
  async function prevCell() {
    try {
      const table = await base.getActiveTable();
      const view = await table.getViewById(viewId.value);
      
      // 获取当前视图的所有记录ID
      const recordIds = await view.getVisibleRecordIdList();
      if (!recordIds || recordIds.length === 0) return;
      
      // 找到当前记录的索引
      const currentIndex = recordIds.findIndex(id => id === recordId.value);
      if (currentIndex === -1) return;
      
      // 计算上一个记录的索引（循环到最后一个）
      const prevIndex = (currentIndex - 1 + recordIds.length) % recordIds.length;
      const prevRecordId = recordIds[prevIndex];
      
      // 设置选择并获取数据
      await base.setSelection({
        tableId: databaseId.value,
        viewId: viewId.value,
        recordId: prevRecordId,
        fieldId: currentFieldId.value
      });
    } catch (error) {
      console.error('导航到上一个单元格时出错:', error);
    }
  }
  
  async function nextCell() {
    try {
      const table = await base.getActiveTable();
      const view = await table.getViewById(viewId.value);
      
      // 获取当前视图的所有记录ID
      const recordIds = await view.getVisibleRecordIdList();
      if (!recordIds || recordIds.length === 0) return;
      
      // 找到当前记录的索引
      const currentIndex = recordIds.findIndex(id => id === recordId.value);
      if (currentIndex === -1) return;
      
      // 计算下一个记录的索引（循环到第一个）
      const nextIndex = (currentIndex + 1) % recordIds.length;
      const nextRecordId = recordIds[nextIndex];
      
      // 设置选择并获取数据
      await base.setSelection({
        tableId: databaseId.value,
        viewId: viewId.value,
        recordId: nextRecordId,
        fieldId: currentFieldId.value
      });
    } catch (error) {
      console.error('导航到下一个单元格时出错:', error);
    }
  }

  base.onSelectionChange(async (event) => {
    // 获取点击的字段id和记录id
    currentFieldId.value = event.data.fieldId;
    recordId.value = event.data.recordId;

    // 获取当前数据表和视图
    databaseId.value = event.data.tableId;
    viewId.value = event.data.viewId;

    const table = await base.getActiveTable();
    if (currentFieldId.value && recordId.value) {
      // 修改当前数据
      let data = await table.getCellValue(currentFieldId.value, recordId.value);
      // 保存原始数据用于调试
      rawData.value = JSON.stringify(data, null, 2);
      if (data) {
        // 处理不同类型的单元格数据
        let textContent = '';
        if (Array.isArray(data)) {
          // 如果是数组，尝试从每个元素中提取文本
          textContent = data.map(item => item.text || item.toString()).filter(Boolean).join('\n');
        } else if (typeof data === 'object' && data !== null) {
          // 如果是对象，尝试获取text属性
          textContent = data.text || JSON.stringify(data);
        } else {
          // 直接使用数据
          textContent = String(data);
        }
        
        // 去除多余的空行
        textContent = textContent.replace(/\n\s*\n/g, '\n');
        
        currentValue.value = textContent;
        showData.value = textContent; // 将单元格内容赋值给展示区域
        console.log('获取到的单元格内容:', textContent); // 添加日志便于调试
      }
    }
  });
</script>

<template>
  <div class="main">
    <div class="label">
      <div class="text">{{ $t('label.base') }}</div>
      <el-select
        v-model="databaseId"
        :placeholder="$t('placeholder.base')"
        @change="databaseChange"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in databaseList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>

    <div class="label">
      <div class="text">{{ $t('label.view') }}</div>
      <el-select
        v-model="viewId"
        :placeholder="$t('placeholder.view')"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in viewList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>
    <div class="label">
      <div class="text">{{ $t('label.field') }}</div>
      <el-select
        v-model="fieldId"
        :placeholder="$t('placeholder.field')"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in fieldList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>

    <div>{{ $t('label.current') }}</div>
    <div class="button-group">
      <el-button
        type="primary"
        @click="prevCell"
        >上一个</el-button
      >
      <el-button
        type="primary"
        @click="nextCell"
        >下一个</el-button
      >
      <el-button
        type="info"
        @click="showDebugInfo = !showDebugInfo"
        >{{ showDebugInfo ? '隐藏调试信息' : '显示调试信息' }}</el-button
      >
      <el-button
        type="success"
        @click="copyMarkdown"
        >{{ copySuccess ? '复制成功' : '复制Markdown' }}</el-button
      >
      <el-button
        :type="isEditMode ? 'warning' : 'primary'"
        @click="toggleEditMode"
        >{{ isEditMode ? '保存编辑' : '编辑内容' }}</el-button
      >
      <el-button
        v-if="isEditMode"
        type="danger"
        @click="saveToCell"
        >保存到表格</el-button
      >
    </div>
    
    <!-- 调试信息 -->
    <div v-if="showDebugInfo" class="debug-info">
      <h3>原始数据:</h3>
      <pre>{{ rawData }}</pre>
    </div>
    
    <!-- 编辑模式 -->
    <div v-if="isEditMode" class="edit-area">
      <el-input
        v-model="editContent"
        type="textarea"
        :rows="15"
        placeholder="编辑Markdown内容..."
      />
    </div>
    
    <!-- 预览模式 -->
    <div
      v-else
      class="show-data markdown-body"
      v-html="showHtml"
    ></div>
  </div>
</template>

<style scoped>
  .main {
    font-weight: normal;
  }

  .label {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .text {
      width: 70px;
      margin-right: 10px;
      white-space: nowrap;
      font-size: 14px;
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      color: #fff;
      background-color: rgb(20, 86, 240);
      border-color: rgb(20, 86, 240);
      box-shadow: 1px 0 0 0 rgb(20, 86, 240);
    }

    :deep(.el-radio-button__inner) {
      font-weight: 300;
    }

    :deep(.el-radio-button__inner:hover) {
      color: rgb(20, 86, 240);
    }

    :deep(.el-input__inner) {
      font-weight: 300;
    }
  }

  .show-data {
    margin-top: 20px;
    width: 100%;
    height: 60vh;
    border: 1px solid #ccc;
    padding: 15px;
    border-radius: 10px;
    overflow: auto;
    word-break: break-word;
    white-space: pre-wrap;
    max-width: 100%;
    box-sizing: border-box;
  }

  .button-group {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  .button-group .el-button {
    margin-right: 10px;
  }

  .debug-info {
    margin-top: 10px;
    padding: 10px;
    background-color: #f8f8f8;
    border: 1px dashed #ccc;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    overflow: auto;
    max-height: 200px;
  }
  
  .edit-area {
    margin-top: 20px;
    width: 100%;
    box-sizing: border-box;
  }
  
  .edit-area :deep(.el-textarea__inner) {
    font-family: monospace;
    height: 60vh;
    resize: none;
  }
</style>

<style>
  .selectStyle {
    .el-select-dropdown__item {
      font-weight: 300 !important;
    }

    .el-select-dropdown__item.selected {
      color: rgb(20, 86, 240);
    }
  }
</style>

<style>
  /* 飞书云文档风格的 Markdown 样式 */
  .markdown-body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji',
      'Segoe UI Emoji';
    font-size: 14px;
    line-height: 1.6;
    color: #1f2329;
  }

  .markdown-body p {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
  
  /* 调整列表项间距 */
  .markdown-body ul,
  .markdown-body ol {
    padding-left: 2em;
    margin: 0.5em 0;
  }

  .markdown-body li {
    margin: 0.15em 0;
  }
  
  /* 减少段落之间的额外空间 */
  .markdown-body p + p {
    margin-top: 0.3em;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {
    margin-top: 1.2em;
    margin-bottom: 0.6em;
    font-weight: 600;
    color: #1f2329;
  }

  .markdown-body h1 {
    font-size: 1.5em;
    border-bottom: 1px solid #e5e6eb;
    padding-bottom: 0.3em;
  }

  .markdown-body h2 {
    font-size: 1.3em;
  }

  .markdown-body h3 {
    font-size: 1.1em;
  }

  .markdown-body strong {
    font-weight: 600;
    color: #1f2329;
  }

  .markdown-body a {
    color: #3370ff;
    text-decoration: none;
  }

  .markdown-body a:hover {
    text-decoration: underline;
  }

  .markdown-body code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 90%;
    background-color: #f2f3f5;
    border-radius: 3px;
    color: #1f2329;
  }

  .markdown-body pre {
    padding: 12px;
    overflow: auto;
    font-size: 90%;
    line-height: 1.45;
    background-color: #f2f3f5;
    border-radius: 4px;
    color: #1f2329;
  }

  .markdown-body blockquote {
    padding: 0 1em;
    color: #646a73;
    border-left: 4px solid #e5e6eb;
    margin: 0;
  }

  .markdown-body table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }

  .markdown-body th,
  .markdown-body td {
    border: 1px solid #e5e6eb;
    padding: 0.5em;
  }

  .markdown-body th {
    background-color: #f2f3f5;
    font-weight: 600;
  }
</style>
