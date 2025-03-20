<!--
 * @Version    : v1.00
 * @Author     : itchaox
 * @Date       : 2023-09-26 15:10
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-03-20 19:29
 * @desc       : 主要页面
-->
<script setup>
  import { bitable } from '@lark-base-open/js-sdk';
  import { marked } from 'marked'; // 引入 marked 库

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
      if (data && data[0].text !== currentValue.value) {
        currentValue.value = data[0].text;
        showData.value = data[0].text; // 将单元格内容赋值给展示区域
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
    <div
      class="show-data markdown-body"
      v-html="showHtml"
    ></div>
    <!-- 添加 markdown-body 类 -->
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
    width: 90%;
    height: 50vh;
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 10px;
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

  .markdown-body ul,
  .markdown-body ol {
    padding-left: 2em;
    margin: 0.5em 0;
  }

  .markdown-body li {
    margin: 0.25em 0;
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
