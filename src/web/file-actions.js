export const markdownFileTypes = [
  { description: "Markdown", accept: { "text/markdown": [".md"], "text/plain": [".md", ".txt"] } }
];

export const markdownInputAccept = ".md,text/markdown,text/plain";

export function createMarkdownBlob(content) {
  return new Blob([content], { type: "text/markdown;charset=utf-8" });
}

export function downloadTextFile(fileName, content, options = {}) {
  const documentRef = options.document || document;
  const urlApi = options.URL || URL;
  const blob = createMarkdownBlob(content);
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = fileName;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(url);
}

export function pickMarkdownFileWithInput(options = {}) {
  const documentRef = options.document || document;
  return new Promise((resolve) => {
    const input = documentRef.createElement("input");
    input.type = "file";
    input.accept = markdownInputAccept;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({ file, name: file.name, content: await file.text() });
    });
    input.click();
  });
}

export async function openMarkdownFileWithPicker(scope = globalThis) {
  const [handle] = await scope.showOpenFilePicker({ types: markdownFileTypes });
  return handle;
}

export async function createMarkdownFileWithPicker(fileName, content, scope = globalThis) {
  const handle = await scope.showSaveFilePicker({
    suggestedName: fileName,
    types: markdownFileTypes
  });
  await writeFileHandle(handle, content);
  return handle;
}

export async function writeFileHandle(handle, content) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
