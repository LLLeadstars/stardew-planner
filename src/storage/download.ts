/**
 * 浏览器文件 I/O 的薄封装。
 * 核心与界面不直接依赖 Blob/URL/FileReader；测试与未来迁移可在此替换实现。
 */
export function saveTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 让下载先接管 blob URL，再在下一个任务释放，避免部分浏览器取消下载。
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
