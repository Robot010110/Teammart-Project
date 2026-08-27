import { Router } from "express";
import multer from "multer";
import { uploadFile, downloadFile } from "../controllers/uploadsController.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.use(requireAuth);

// multer's own errors (file too large, fileFilter rejection) reach this
// as a MulterError/Error thrown before uploadFile ever runs — turned
// into a real 400 here instead of falling through to the generic 500 in
// the shared error handler, since these are always a client mistake
// (wrong file type, file too big), never a server fault.
router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Invalid file" });
    }
    next();
  });
}, uploadFile);

// The only way to read an uploaded file back — see
// uploadsController.downloadFile's own comment. Every request is
// authenticated (requireAuth above) AND authorized per-file
// (fileAuthorization.js) before any bytes are returned.
router.get("/:filename", downloadFile);

export default router;
