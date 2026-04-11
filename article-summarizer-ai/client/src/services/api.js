import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 120000,
  headers: {
    "Content-Type": "application/json"
  }
});

export const summarizeUrl = async (payload) => {
  const response = await api.post("/summarize-url", payload);
  return response.data;
};

export const summarizeText = async (payload) => {
  const response = await api.post("/summarize-text", payload);
  return response.data;
};

export const summarizeVideo = async ({ file, language, mode = "summary", onUploadProgress }) => {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("language", language);
  formData.append("mode", mode);

  const response = await api.post("/summarize-video", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onUploadProgress(progress);
      }
    }
  });

  return response.data;
};

export const summarizeAudio = async ({ file, language, mode = "summary", onUploadProgress }) => {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("language", language);
  formData.append("mode", mode);

  const response = await api.post("/summarize-audio", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onUploadProgress(progress);
      }
    }
  });

  return response.data;
};

export const summarizeDocument = async ({ file, language, mode = "summary", onUploadProgress }) => {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("language", language);
  formData.append("mode", mode);

  const response = await api.post("/summarize-document", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onUploadProgress(progress);
      }
    }
  });

  return response.data;
};

export const summarizeImage = async ({ file, language, onUploadProgress }) => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("language", language);

  const response = await api.post("/summarize-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onUploadProgress(progress);
      }
    }
  });

  return response.data;
};

export const askArticleChat = async (payload) => {
  const response = await api.post("/chat", payload);
  return response.data;
};

export const getHistory = async () => {
  const response = await api.get("/history");
  return response.data;
};

export const deleteHistoryItem = async (id) => {
  const response = await api.delete(`/history/${id}`);
  return response.data;
};
