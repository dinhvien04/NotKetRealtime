const path = require("path");
const FileType = require("file-type");
const yauzl = require("yauzl");
const { isAllowedMimeType } = require("./mime");

const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".cjs",
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".php",
  ".zip",
  ".rar",
  ".7z"
]);

const OFFICE_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const OFFICE_OPEN_XML_PATHS = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "[Content_Types].xml",
    "word/document.xml"
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "[Content_Types].xml",
    "xl/workbook.xml"
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "[Content_Types].xml",
    "ppt/presentation.xml"
  ]
};

const MAX_ZIP_ENTRIES = 200;
const MAX_ZIP_FILENAME_LENGTH = 255;

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"
};

function hasBlockedExtension(fileName) {
  const extension = path.extname(String(fileName || "")).toLowerCase();
  return BLOCKED_EXTENSIONS.has(extension);
}

function isSafePlainText(buffer) {
  if (!buffer || buffer.length === 0) {
    return false;
  }
  if (buffer.includes(0)) {
    return false;
  }
  const text = buffer.toString("utf8");
  return Buffer.from(text, "utf8").equals(buffer);
}

function listZipEntryNames(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zipfile) => {
        if (error || !zipfile) {
          reject(error || new Error("Không thể đọc file ZIP."));
          return;
        }

        const entries = [];
        let entryCount = 0;

        zipfile.on("entry", (entry) => {
          entryCount += 1;
          if (entryCount > MAX_ZIP_ENTRIES) {
            zipfile.close();
            reject(new Error("File ZIP có quá nhiều mục."));
            return;
          }

          if (entry.fileName.length > MAX_ZIP_FILENAME_LENGTH) {
            zipfile.close();
            reject(new Error("Tên file trong ZIP không hợp lệ."));
            return;
          }

          entries.push(entry.fileName);
          zipfile.readEntry();
        });

        zipfile.on("end", () => resolve(entries));
        zipfile.on("error", (zipError) => reject(zipError));
        zipfile.readEntry();
      }
    );
  });
}

async function validateOfficeOpenXml(buffer, declaredMimeType) {
  const requiredPaths = OFFICE_OPEN_XML_PATHS[declaredMimeType];
  if (!requiredPaths) {
    return;
  }

  const entries = await listZipEntryNames(buffer);
  const normalized = new Set(entries.map((entry) => entry.toLowerCase()));

  for (const requiredPath of requiredPaths) {
    if (!normalized.has(requiredPath.toLowerCase())) {
      throw new Error("Cấu trúc file Office không hợp lệ.");
    }
  }
}

function mimeTypesMatch(declaredMimeType, detectedMime) {
  if (detectedMime === declaredMimeType) {
    return true;
  }

  if (detectedMime === "application/zip" && OFFICE_OPEN_XML_PATHS[declaredMimeType]) {
    return true;
  }

  if (
    declaredMimeType === "application/msword" &&
    (detectedMime === "application/x-cfb" || detectedMime === "application/msword")
  ) {
    return true;
  }

  return false;
}

async function validateUploadedFile({ buffer, declaredMimeType, originalName }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("File không hợp lệ.");
  }

  if (hasBlockedExtension(originalName)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  if (!isAllowedMimeType(declaredMimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  if (declaredMimeType === "text/plain") {
    if (!isSafePlainText(buffer)) {
      throw new Error("Nội dung file text không hợp lệ.");
    }
    return declaredMimeType;
  }

  let detected;
  try {
    detected = await FileType.fromBuffer(buffer);
  } catch (_error) {
    throw new Error("Không thể xác định loại file từ nội dung.");
  }

  if (!detected) {
    throw new Error("Không thể xác định loại file từ nội dung.");
  }

  if (!mimeTypesMatch(declaredMimeType, detected.mime)) {
    throw new Error("Nội dung file không khớp với loại MIME đã khai báo.");
  }

  if (OFFICE_OPEN_XML_PATHS[declaredMimeType]) {
    await validateOfficeOpenXml(buffer, declaredMimeType);
  }

  if (!isAllowedMimeType(detected.mime) && !OFFICE_MIME_TYPES.has(declaredMimeType)) {
    throw new Error("Loại file không được hỗ trợ.");
  }

  return declaredMimeType;
}

function extensionFromMimeType(mimeType) {
  return MIME_EXTENSION_MAP[mimeType] || "bin";
}

module.exports = {
  BLOCKED_EXTENSIONS,
  hasBlockedExtension,
  validateUploadedFile,
  extensionFromMimeType,
  isSafePlainText,
  mimeTypesMatch,
  validateOfficeOpenXml,
  listZipEntryNames
};
