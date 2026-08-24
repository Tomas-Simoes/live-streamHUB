import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { getBackendApiUrl } from "../helper/url.helpers";

export type UploadedMedia = {
  url: string;
  key: string;
  bucket?: string;
  contentType: string;
  originalName: string;
  size: number;
  storage: "r2" | "local";
  localFilePath?: string;
};

@Injectable({ providedIn: "root" })
export class ImageApi {
  private readonly baseUrl = `${getBackendApiUrl()}/media`;
  private readonly httpOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  uploadImage(file: File) {
    return this.upload("image", file);
  }

  uploadVideo(file: File) {
    return this.upload("video", file);
  }

  private upload(kind: "image" | "video", file: File) {
    const formData = new FormData();

    formData.append("file", file);

    return this.http.post<UploadedMedia>(
      `${this.baseUrl}/${kind}`,
      formData,
      this.httpOptions,
    );
  }
}
