<!--
 * @Version    : v1.01
 * @Author     : itchaox
 * @Date       : 2023-09-26 15:10
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-03-20 20:04
 * @desc       : 主要页面
-->
<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { bitable } from '@lark-base-open/js-sdk';
  import { marked } from 'marked'; // 引入 marked 库
  import { ElMessage } from 'element-plus'; // 导入 ElMessage 组件

  // 配置 marked
  marked.setOptions({
    gfm: true, // 支持 GitHub Flavored Markdown
    breaks: true, // 将换行符转换为 <br>
  });

  // 状态变量
  const currentValue = ref('');
  const showData = ref(''); // 用于存储展示区域的数据
  const showHtml = computed(() => marked(showData.value)); // 将 Markdown 转换为 HTML
  
  // 导航状态
  const isLoading = ref(false);
  const currentRecordId = ref(null);
  const recordList = ref([]);
  const currentIndex = ref(-1);
  
  const base = bitable.base;

  // 简单的复制功能
  const copyContent = async () => {
    if (!showData.value) {
      ElMessage.warning('没有可复制的内容');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(showData.value);
      ElMessage.success('复制成功');
    } catch (err) {
      console.error('复制失败:', err);
      // 备选复制方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = showData.value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        ElMessage.success('复制成功');
      } catch (fallbackErr) {
        ElMessage.error('复制失败，请手动复制');
      }
    }
  };

  // 安全获取单元格文本
  const getCellText = async (tableId, recordId, fieldId) => {
    try {
      isLoading.value = true;
      
      if (!tableId || !recordId || !fieldId) {
        console.error('参数无效:', { tableId, recordId, fieldId });
        return '';
      }
      
      // 获取表格
      const table = await base.getTable(tableId);
      if (!table) {
        console.error('获取表格失败');
        return '';
      }
      
      try {
        // 获取单元格值
        const cellValue = await table.getCellValue(fieldId, recordId);
        
        // 处理不同类型的值
        if (!cellValue) {
          return '';
        } else if (typeof cellValue === 'string') {
          return cellValue;
        } else if (Array.isArray(cellValue)) {
          // 安全处理数组
          const textParts = [];
          for (let i = 0; i < cellValue.length; i++) {
            try {
              const item = cellValue[i];
              if (typeof item === 'string') {
                textParts.push(item);
              } else if (item && typeof item === 'object' && item.text) {
                textParts.push(item.text);
              }
            } catch (e) {
              console.warn('处理数组元素出错:', e);
            }
          }
          return textParts.join('\n');
        } else if (cellValue && typeof cellValue === 'object') {
          // 安全处理对象
          if (cellValue.text) {
            return cellValue.text;
          } else {
            // 尝试其他常见属性
            const valueProps = ['value', 'name', 'title', 'content'];
            for (const prop of valueProps) {
              if (cellValue[prop] && typeof cellValue[prop] === 'string') {
                return cellValue[prop];
              }
            }
            // 最后尝试 JSON 字符串化（排除 context 属性）
            try {
              // 创建一个新对象，排除 context 属性
              const safeObj = {};
              Object.keys(cellValue)
                .filter(key => key !== 'context')
                .forEach(key => {
                  try {
                    safeObj[key] = cellValue[key];
                  } catch (e) {
                    // 忽略无法访问的属性
                  }
                });
              return JSON.stringify(safeObj);
            } catch (e) {
              console.warn('JSON 序列化失败:', e);
              return '[复杂对象]';
            }
          }
        } else {
          // 其他类型，尝试转换为字符串
          return String(cellValue);
        }
      } catch (cellError) {
        console.error('获取单元格值失败:', cellError);
        return '[获取数据出错]';
      }
    } catch (e) {
      console.error('获取文本失败:', e);
      return '[处理失败]';
    } finally {
      isLoading.value = false;
    }
  };

  // 导航到下一个记录
  const goToNext = async () => {
    if (isLoading.value || currentIndex.value < 0 || currentIndex.value >= recordList.value.length - 1) {
      return;
    }
    
    try {
      isLoading.value = true;
      
      // 增加索引并获取下一个记录ID
      currentIndex.value += 1;
      currentRecordId.value = recordList.value[currentIndex.value];
      
      // 获取记录对应的当前单元格数据
      const selection = await base.getSelection();
      if (!selection || !selection.fieldId || !selection.tableId) {
        throw new Error('无效的选择信息');
      }
      
      // 获取并更新内容
      const content = await getCellText(selection.tableId, currentRecordId.value, selection.fieldId);
      showData.value = content;
      currentValue.value = content;
      
      // 不再尝试更新表格选择状态，只更新界面显示
      /* 
      await base.setSelection({
        tableId: selection.tableId,
        viewId: selection.viewId,
        fieldId: selection.fieldId,
        recordId: currentRecordId.value
      });
      */
    } catch (err) {
      console.error('导航到下一个记录失败:', err);
      ElMessage.error('导航失败: ' + (err.message || '未知错误'));
    } finally {
      isLoading.value = false;
    }
  };

  // 导航到上一个记录
  const goToPrevious = async () => {
    if (isLoading.value || currentIndex.value <= 0) {
      return;
    }
    
    try {
      isLoading.value = true;
      
      // 减少索引并获取上一个记录ID
      currentIndex.value -= 1;
      currentRecordId.value = recordList.value[currentIndex.value];
      
      // 获取记录对应的当前单元格数据
      const selection = await base.getSelection();
      if (!selection || !selection.fieldId || !selection.tableId) {
        throw new Error('无效的选择信息');
      }
      
      // 获取并更新内容
      const content = await getCellText(selection.tableId, currentRecordId.value, selection.fieldId);
      showData.value = content;
      currentValue.value = content;
      
      // 不再尝试更新表格选择状态，只更新界面显示
      /*
      await base.setSelection({
        tableId: selection.tableId,
        viewId: selection.viewId,
        fieldId: selection.fieldId,
        recordId: currentRecordId.value
      });
      */
    } catch (err) {
      console.error('导航到上一个记录失败:', err);
      ElMessage.error('导航失败: ' + (err.message || '未知错误'));
    } finally {
      isLoading.value = false;
    }
  };

  // 加载记录列表
  const loadRecordList = async () => {
    try {
      isLoading.value = true;
      
      // 获取当前选择信息
      const selection = await base.getSelection();
      if (!selection || !selection.tableId) {
        console.warn('无效的选择信息');
        return;
      }
      
      // 获取表格和视图
      const table = await base.getTable(selection.tableId);
      if (!table) {
        console.error('无法获取表格');
        return;
      }
      
      let view;
      try {
        view = await table.getViewById(selection.viewId);
      } catch (viewError) {
        console.warn('获取视图失败，尝试获取活动视图:', viewError);
        view = await table.getActiveView();
      }
      
      if (!view) {
        console.error('无法获取视图');
        return;
      }
      
      // 获取记录列表
      const records = await view.getVisibleRecordIdList();
      
      if (!records || records.length === 0) {
        console.warn('当前视图没有记录');
        recordList.value = [];
        currentIndex.value = -1;
        return;
      }
      
      recordList.value = records;
      console.log('加载记录列表成功，共', records.length, '条记录');
      
      // 查找当前记录索引
      if (selection.recordId) {
        currentRecordId.value = selection.recordId;
        currentIndex.value = records.findIndex(id => id === selection.recordId);
        
        if (currentIndex.value === -1) {
          console.warn('当前记录不在可见记录列表中');
          currentIndex.value = 0;
          currentRecordId.value = records[0];
        }
      } else {
        currentIndex.value = 0;
        currentRecordId.value = records[0];
      }
    } catch (err) {
      console.error('加载记录列表失败:', err);
      ElMessage.error('加载记录列表失败');
      recordList.value = [];
      currentIndex.value = -1;
    } finally {
      isLoading.value = false;
    }
  };

  // 处理选择变化
  const handleSelectionChange = async (event) => {
    try {
      if (!event || !event.data) {
        return;
      }
      
      const { tableId, viewId, recordId, fieldId } = event.data;
      
      if (!tableId || !recordId || !fieldId) {
        return;
      }
      
      // 获取并显示单元格内容
      const content = await getCellText(tableId, recordId, fieldId);
      showData.value = content;
      currentValue.value = content;
      
      // 加载/更新记录列表并找到当前索引
      await loadRecordList();
    } catch (err) {
      console.error('处理选择变化时出错:', err);
    }
  };

  // 监听选择变化
  onMounted(() => {
    base.onSelectionChange(handleSelectionChange);
  });
</script>

<template>
  <div class="main">
    <!-- 操作按钮区域 -->
    <div class="action-bar">
      <div class="navigation-buttons">
        <el-button type="primary" size="small" @click="goToPrevious" :disabled="currentIndex <= 0 || isLoading">
          上一个
        </el-button>
        <span v-if="recordList.length > 0" class="record-indicator">
          {{ currentIndex + 1 }} / {{ recordList.length }}
        </span>
        <el-button type="primary" size="small" @click="goToNext" :disabled="currentIndex >= recordList.length - 1 || isLoading">
          下一个
        </el-button>
      </div>
      <el-button type="success" size="small" @click="copyContent" :disabled="!showData">
        复制内容
      </el-button>
    </div>
    
    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading-indicator">
      正在加载...
    </div>
    
    <!-- 预览模式 -->
    <div v-else class="show-data markdown-body" v-html="showHtml"></div>
  </div>
</template>

<style scoped>
  .main {
    font-weight: normal;
    padding: 16px 24px;
  }
  
  .action-bar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .navigation-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .record-indicator {
    font-size: 14px;
    color: #606266;
    margin: 0 8px;
  }
  
  .loading-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: #909399;
    font-size: 14px;
  }

  .show-data {
    width: 100%;
    min-height: calc(100vh - 80px);
    border: none;
    padding: 0;
    border-radius: 0;
    overflow: auto;
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
    box-sizing: border-box;
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
    max-width: 850px;
    margin: 0 auto;
  }

  /* 标题样式 */
  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4,
  .markdown-body h5,
  .markdown-body h6 {
    margin-top: 1.2em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
    color: #1f2329;
  }

  .markdown-body h1 {
    font-size: 1.75em;
    margin-top: 0.5em;
    padding-bottom: 0.2em;
    border-bottom: 1px solid #e5e6eb;
  }

  .markdown-body h2 {
    font-size: 1.5em;
    padding-bottom: 0.2em;
    border-bottom: 1px solid #e5e6eb;
  }

  .markdown-body h3 { font-size: 1.25em; }
  .markdown-body h4 { font-size: 1em; }
  .markdown-body h5 { font-size: 0.875em; }
  .markdown-body h6 { font-size: 0.85em; }

  /* 段落和文本样式 */
  .markdown-body p {
    margin: 0.5em 0;
    line-height: 1.6;
    white-space: normal;
  }

  .markdown-body p + p {
    margin-top: 0.8em;
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

  /* 代码样式 */
  .markdown-body code {
    padding: 0.2em 0.4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(175,184,193,0.2);
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  }

  .markdown-body pre {
    padding: 12px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
    margin: 0.8em 0;
  }

  .markdown-body pre code {
    padding: 0;
    margin: 0;
    background-color: transparent;
    border: 0;
    white-space: pre;
    font-size: inherit;
  }

  /* 引用样式 */
  .markdown-body blockquote {
    padding: 0 1em;
    color: #57606a;
    border-left: 0.25em solid #d0d7de;
    margin: 0.8em 0;
  }

  /* 列表样式 */
  .markdown-body ul,
  .markdown-body ol {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  .markdown-body li {
    margin: 0.2em 0;
    line-height: 1.6;
  }

  .markdown-body li + li {
    margin-top: 0.1em;
  }

  /* 表格样式 */
  .markdown-body table {
    display: table;
    width: 100%;
    max-width: 100%;
    overflow: auto;
    margin: 0.8em 0;
    border-spacing: 0;
    border-collapse: collapse;
    border: 1px solid #d0d7de;
  }

  .markdown-body table th {
    font-weight: 600;
    background-color: #f6f8fa;
  }

  .markdown-body table th,
  .markdown-body table td {
    padding: 6px 12px;
    border: 1px solid #d0d7de;
    line-height: 1.5;
  }

  .markdown-body table tr {
    background-color: #ffffff;
    border-top: 1px solid #d0d7de;
  }

  .markdown-body table tr:nth-child(2n) {
    background-color: #f6f8fa;
  }

  /* 水平线样式 */
  .markdown-body hr {
    height: 1px;
    padding: 0;
    margin: 16px 0;
    background-color: #d0d7de;
    border: 0;
  }

  /* 图片样式 */
  .markdown-body img {
    max-width: 100%;
    box-sizing: border-box;
    border-radius: 3px;
  }

  /* 调整列表嵌套间距 */
  .markdown-body ul ul,
  .markdown-body ul ol,
  .markdown-body ol ul,
  .markdown-body ol ol {
    margin: 0.2em 0;
  }

  /* 调整段落在列表中的表现 */
  .markdown-body li > p {
    margin: 0.3em 0;
  }

  /* 调整代码块在列表中的表现 */
  .markdown-body li > pre {
    margin: 0.3em 0;
  }

  /* 处理连续标题的间距 */
  .markdown-body h1 + h2,
  .markdown-body h2 + h3,
  .markdown-body h3 + h4,
  .markdown-body h4 + h5,
  .markdown-body h5 + h6 {
    margin-top: 0.8em;
  }
</style>
