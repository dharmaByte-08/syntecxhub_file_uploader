const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#file-input');
const fileLabel = document.querySelector('#file-label');
const dropzone = document.querySelector('#dropzone');
const uploadButton = document.querySelector('#upload-button');
const progress = document.querySelector('#progress');
const progressBar = document.querySelector('#progress-bar');
const status = document.querySelector('#status');
const list = document.querySelector('#file-list');
const empty = document.querySelector('#empty');
const search = document.querySelector('#search');
const libraryMeta = document.querySelector('#library-meta');
const defaultHint = fileLabel.textContent;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'csv', 'json', 'zip', 'docx']);

let searchTimer;

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind ? `status is-${kind}` : 'status';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function readError(response) {
  try {
    const body = await response.json();
    return body.error || 'Request failed.';
  } catch {
    return 'Request failed.';
  }
}

function typeLabel(contentType) {
  if (contentType === 'image/jpeg') return 'JPEG';
  if (contentType === 'image/png') return 'PNG';
  if (contentType === 'image/gif') return 'GIF';
  if (contentType === 'image/webp') return 'WebP';
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType === 'text/plain') return 'Text';
  if (contentType === 'text/csv') return 'CSV';
  if (contentType === 'application/json') return 'JSON';
  if (contentType === 'application/zip') return 'ZIP';
  if (contentType.includes('wordprocessingml')) return 'DOCX';
  return 'File';
}

function renderFiles(files, totalSize) {
  list.replaceChildren();
  const searching = search.value.trim().length > 0;
  empty.textContent = searching ? 'No matching files.' : 'No files yet.';
  empty.classList.toggle('hidden', files.length > 0);
  libraryMeta.textContent = files.length
    ? `${files.length} file${files.length === 1 ? '' : 's'} · ${formatSize(totalSize)}`
    : '';

  for (const file of files) {
    const item = document.createElement('li');
    item.className = 'file-row';

    const main = document.createElement('div');
    main.className = 'file-main';

    if (file.contentType.startsWith('image/')) {
      const image = document.createElement('img');
      image.className = 'thumb';
      image.alt = '';
      image.src = `/api/files/${file.id}`;
      main.append(image);
    }

    const details = document.createElement('div');
    details.className = 'file-copy';
    const name = document.createElement('strong');
    name.textContent = file.filename;
    const meta = document.createElement('span');
    meta.textContent = `${typeLabel(file.contentType)} · ${formatSize(file.size)} · ${formatDate(file.uploadDate)}`;
    details.append(name, meta);
    main.append(details);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const download = document.createElement('a');
    download.className = 'ghost';
    download.href = `/api/files/${file.id}?download=1`;
    download.textContent = 'Download';

    const copy = document.createElement('button');
    copy.className = 'ghost';
    copy.type = 'button';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', () => copyLink(file));

    const remove = document.createElement('button');
    remove.className = 'danger';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      if (remove.dataset.armed !== '1') {
        remove.dataset.armed = '1';
        remove.textContent = 'Confirm';
        window.setTimeout(() => {
          if (!remove.isConnected) return;
          remove.dataset.armed = '0';
          remove.textContent = 'Delete';
        }, 3000);
        return;
      }
      deleteFile(file.id, file.filename);
    });

    actions.append(download, copy, remove);
    item.append(main, actions);
    list.append(item);
  }
}

async function loadFiles() {
  const query = search.value.trim();
  const response = await fetch(`/api/files${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  if (!response.ok) {
    setStatus(await readError(response), 'error');
    return;
  }
  const body = await response.json();
  renderFiles(body.files, body.totalSize);
}

async function copyLink(file) {
  const link = `${location.origin}/api/files/${file.id}`;
  try {
    await navigator.clipboard.writeText(link);
    setStatus(`Copied link for ${file.filename}.`, 'ok');
  } catch {
    setStatus(link, 'ok');
  }
}

function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file);
    const request = new XMLHttpRequest();
    request.open('POST', '/api/files');
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      progress.classList.remove('hidden');
      progressBar.style.width = `${percent}%`;
      setStatus(`Uploading… ${percent}%`);
    };
    request.onload = () => {
      let payload = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }
      reject(new Error(payload.error || 'Request failed.'));
    };
    request.onerror = () => reject(new Error('Upload failed.'));
    request.send(body);
  });
}

async function deleteFile(id, filename) {
  const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    setStatus(await readError(response), 'error');
    return;
  }
  setStatus(`Deleted ${filename}.`, 'ok');
  await loadFiles();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileLabel.textContent = file ? file.name : defaultHint;
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-hot');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-hot');
  });
});

dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileLabel.textContent = file.name;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setStatus('Choose a file first.', 'error');
    return;
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    setStatus('File type is not allowed. Use an image, PDF, text, CSV, JSON, ZIP, or DOCX file.', 'error');
    return;
  }
  if (file.size === 0) {
    setStatus('The file is empty.', 'error');
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    setStatus('File is larger than 10 MB.', 'error');
    return;
  }

  uploadButton.disabled = true;
  progress.classList.remove('hidden');
  progressBar.style.width = '0%';

  try {
    const saved = await uploadFile(file);
    setStatus(`Uploaded ${saved.filename}.`, 'ok');
    form.reset();
    fileLabel.textContent = defaultHint;
    await loadFiles();
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    uploadButton.disabled = false;
    progress.classList.add('hidden');
    progressBar.style.width = '0%';
  }
});

search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    loadFiles().catch(() => setStatus('Could not load files.', 'error'));
  }, 200);
});

document.querySelector('#refresh').addEventListener('click', loadFiles);
loadFiles().catch(() => setStatus('Could not load files.', 'error'));
