# File Vault

File upload API for the Syntechub file uploader task. Uploads are read with Multer and stored in MongoDB GridFS.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000.

If `MONGODB_URI` is set, that database is used. Otherwise the app tries `mongodb://127.0.0.1:27017/filevault`, then starts an in-memory MongoDB so you can try the API without installing a server. In-memory files disappear when the process stops.

Copy `.env.example` to `.env` when you want a saved database.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/files` | Upload one file. Field name: `file`. |
| `GET` | `/api/files` | List files. Add `?q=` to search by name. |
| `GET` | `/api/files/:id` | Preview or download a file. Add `?download=1` to force a download. |
| `DELETE` | `/api/files/:id` | Delete a file and its GridFS chunks. |

Allowed types: JPEG, PNG, GIF, WebP, PDF, plain text, CSV, JSON, ZIP, DOCX. Maximum size: 10 MB. The server checks the file bytes, so a renamed executable is rejected even if the browser calls it an image or text file. Empty files and invalid JSON are rejected. A bad id returns 400. A missing file returns 404.

```bash
curl -F "file=@notes.txt" http://localhost:3000/api/files
curl http://localhost:3000/api/files
curl -O http://localhost:3000/api/files/FILE_ID?download=1
curl -X DELETE http://localhost:3000/api/files/FILE_ID
```
